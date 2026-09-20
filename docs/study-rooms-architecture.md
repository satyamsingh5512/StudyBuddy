# Study Rooms — architecture and implementation plan

Status: Phase 1–4 and 6–9 backend implemented; frontend slice implemented. Resource
Vault, room analytics dashboards, and AI coach are designed here and deliberately
deferred (see "Deferred work" at the end).

This document is grounded in the **actual** StudyBuddy stack, not a generic one. Two
requirements from the original brief cannot be implemented as literally stated, and
the reasons are load-bearing for the rest of the design:

| Brief said | Reality in this repo | What we do instead |
| --- | --- | --- |
| Use WebSockets, "avoid excessive websocket traffic", "secure WebSocket authorization" | There is no WS server. `backend/internal/realtime/broker.go` is a **Redis Streams long-poll** feed (`GET /api/realtime/changes`), sized for a ~20 MB free Redis on Azure App Service B1. Fiber's websocket support is not a dependency. | Extend the same broker with **room streams**. Long-poll keeps one in-flight request per client, survives Azure idle-timeouts, needs no sticky sessions, and cannot exhaust the free Redis connection cap. Authorization reuses `middleware.RequireAuth` + a membership check — no separate WS auth surface to get wrong. |
| Android offline-first with Room / SQLite | `android/` is a **Capacitor 6 shell** that loads the same Next.js app (`capacitor.config.ts`, `scripts/prepare-android.mjs`). The only native code is the focus-enforcer plugin (`resources/android/*.java`). There is no Kotlin app and no Room dependency. | Reuse the existing web offline primitives in `src/lib/offline/` (snapshot cache + mutation outbox, already unit-tested by `tests/frontend/offline-outbox.test.ts`) and `src/config/api.ts`'s snapshot fallback. Adding Room would mean writing a second, native client app — a separate project, not a feature. |

### Known ceiling: concurrent long-polls per instance

A blocking `XREAD` holds one Redis connection for the duration of its block, and a
user with a room open runs **two** long-polls (their personal stream plus the room
stream). The realtime pool is therefore sized at 18 connections
(`broker.go`), which supports roughly **9 concurrent room viewers per instance**
before a poll has to wait; `internal/cache` keeps its own pool of 5, staying under
the ~30-connection free-tier cap. Past that ceiling clients degrade to interval
polling instead of erroring. Raising the ceiling means a paid Redis plan or moving
the fan-out to a dedicated pub/sub process — not a code change. This is stated
here rather than hidden because it is the binding scalability limit of the current
deployment.

Everything else in the brief is implemented or explicitly deferred below.

---

## Phase 1 — Architecture

### Where Study Rooms sits

```
Next.js (app/ thin routes) ──► src/views/StudyRooms*.tsx
        │                              │
        │ TanStack Query               │ Jotai for ephemeral UI state only
        ▼                              ▼
src/lib/roomQueries.ts  ── same-origin /api proxy ──►  Go Fiber
                                                        │
        ┌───────────────────────────────────────────────┼───────────────┐
        ▼                       ▼                       ▼               ▼
 handlers/rooms.go     handlers/room_chat.go   handlers/room_presence.go  handlers/room_sessions.go
        │                       │                       │               │
        └──────────── models/room.go (pure domain + validation) ────────┘
                                │
                MongoDB Atlas M0  +  Redis (optional: streams + shared cache)
```

Decisions:

- **Feature-sliced handlers, shared domain package.** The repo already groups by
  feature (`goals*.go`, `journal*.go`). Rooms follow it: five handler files, one
  `models/room.go` holding every pure function. Pure domain logic is the part we can
  unit test without a Mongo instance, which is how every existing backend test works
  (`foundations_test.go`, `goals_test.go` — no testcontainers anywhere).
- **Additive-only.** New collections, new routes, new files. No existing collection,
  route, model field, or component is modified in a breaking way. `users` gains XP
  fields by `$inc` upsert semantics, which is backward compatible with documents that
  lack them (Go zero values decode fine).
- **Degrade, never fail.** Redis is optional today and stays optional: with no
  `REDIS_URL`, rooms still work — presence falls back to Mongo TTL documents and the
  client falls back to interval refetch. This mirrors `cache.Enabled()`/
  `realtime.Enabled()` handling already in the codebase.

Risks / mitigations:

| Risk | Mitigation |
| --- | --- |
| Rooms become the highest-write feature and exhaust Atlas M0 (512 MB, shared CPU) | Presence is a **capped-size TTL collection** (one doc per member per room, updated in place, not appended), chat is paginated by `_id`, leaderboards are aggregated on a cache TTL rather than per request. |
| Free Redis (20 MB) evicted by room traffic | Room streams are capped at `maxEventsPerRoom = 200` like the user streams, carry **topic only** (no message bodies), and one event serves all N viewers — fan-out is O(1) writes, O(1) reads per viewer. |
| Feature sprawl making rooms unmaintainable | All cross-cutting rules (who may post, who may moderate, what counts as XP) live in `models/room.go` as pure functions, so they are testable and have exactly one definition. |

---

## Phase 2 — Database design

Seven new collections. Reasoning for each, because "why not embed" is the real
question on a document database.

### `study_rooms`

One document per room: name, slug, description, tags, category, cover image, rules,
visibility (`public` / `private` / `goal` / `elite`), owner, entry requirements, goal
definition, denormalized `memberCount` / `activeMemberCount` / `totalStudyMinutes`.

*Why a separate collection and not members embedded:* a room is read by many users
who must not receive the full member roster in every payload, and member arrays would
grow unbounded against the 16 MB document limit. Counters are denormalized because
discovery sorts by them and `$lookup`-counting on every list request is the classic
N+1 shape we must avoid.

### `room_members`

`(roomId, userId)` unique. Holds `role` (`owner` / `moderator` / `member`),
`joinedAt`, `status` (`active` / `pending` / `banned`), per-room contribution
(`studyMinutes`, `sessionsCompleted`, `xp`), and `lastSeenAt`.

*Why:* membership is the authorization edge for every room request, so it must be a
single indexed point lookup. Storing per-room contribution here (not recomputed from
sessions) makes the room leaderboard a covered query over one index instead of an
aggregation over the whole session history.

### `room_presence`

One doc per `(roomId, userId)`, updated in place by heartbeat: `state`
(`online` / `studying` / `deep_focus` / `break` / `away`), `sessionStartedAt`,
`focusMinutes`, `expiresAt`.

*Why a separate collection with a TTL index:* presence is high-churn, low-value data.
Keeping it out of `room_members` stops presence writes from touching the
authorization-critical document, and a Mongo TTL index (`expireAfterSeconds: 0` on
`expiresAt`) makes "offline" the automatic default without a cron job. Absence of a
document **is** offline — no stale-online bug.

### `room_sessions`

A shared focus session: `roomId`, `hostId`, `mode` (`pomodoro` / `custom` /
`deep_work`), `plannedMinutes`, `startsAt`, `endsAt`, `status`, `participantCount`.

*Why:* synchronized start time must be server-authoritative, otherwise clients drift
and "studying together" is a lie. Clients render a countdown from `startsAt`; they
never decide it.

### `room_session_participants`

`(sessionId, userId)` unique: the accountability record — `declaredGoal`,
`declaredTopic`, `declaredMinutes`, `outcome` (`completed` / `partial` / `missed`),
`actualMinutes`, `xpAwarded`.

*Why separate from `room_sessions`:* participants are written independently and
concurrently by each member; embedding them in the session document would make every
join a contended update on one hot document.

### `room_messages`

`roomId`, `userId`, `body`, `replyToId`, `mentions[]`, `reactions` (map emoji →
userIds), `deleted`, `deletedBy`, `pinned`, `createdAt`.

*Why reactions embedded but messages not:* a reaction set is bounded and always read
with its message; messages per room are unbounded. Pagination is keyed on `_id`
(monotonic ObjectId) descending, matching how `handlers/messages.go` already
paginates DMs with `before`.

### `room_resources` (schema defined, endpoints deferred)

`roomId`, `kind` (`note` / `link` / `pdf`), `title`, `url` or `noteId`, `addedBy`,
`visibility`. A `text` index on `title`/`description` is provisioned so search can be
added without a migration.

### Index strategy

Every index is registered in `middleware/indexes.go` (idempotent `CreateMany` at boot,
already the established pattern) and named `idx_`/`uq_` consistently. The rule applied:
**one index per access path actually used by a handler, no speculative ones**, because
M0 has limited RAM for index working set.

---

## Phase 3 — Backend APIs

All routes are under `protected` (`middleware.RequireAuth`), so cookie auth and
`SessionVersion` revocation apply unchanged. Rate limits use the existing
`middleware.RateLimit` (per-user once authenticated, per-IP before).

| Method | Path | Purpose | Limit |
| --- | --- | --- | --- |
| GET | `/api/rooms` | Discover: filter `q`, `category`, `tag`, `visibility`, `sort`, cursor `before`, `limit`≤50 | 120/min |
| POST | `/api/rooms` | Create (creator becomes owner) | 10/h |
| GET | `/api/rooms/mine` | Rooms the caller belongs to | 120/min |
| GET | `/api/rooms/:id` | Room detail + caller's role/eligibility | 120/min |
| PATCH | `/api/rooms/:id` | Owner/mod edit (mods cannot change visibility or requirements) | 30/min |
| DELETE | `/api/rooms/:id` | Owner only, soft archive | 5/h |
| POST | `/api/rooms/:id/restore` | Owner only, un-archive (archiving is reversible) | 5/h |
| POST | `/api/rooms/:id/transfer/:userId` | Owner hands the room to another active member and becomes a moderator | 5/h |
| POST | `/api/rooms/:id/join` | Join; enforces visibility + elite requirements | 30/h |
| POST | `/api/rooms/:id/leave` | Leave; owner must transfer first | 30/h |
| GET | `/api/rooms/:id/members` | Paginated roster | 120/min |
| PATCH | `/api/rooms/:id/members/:userId` | Promote/demote/ban (owner, or mod for ban-member) | 60/h |
| GET | `/api/rooms/:id/presence` | Virtual desks snapshot | 240/min |
| POST | `/api/rooms/:id/presence` | Heartbeat (state + focus minutes) | 240/min |
| GET | `/api/rooms/:id/messages` | Paginated history, cursor `before` | 240/min |
| POST | `/api/rooms/:id/messages` | Post (body ≤ 2000 runes) | 30/min |
| POST | `/api/rooms/:id/messages/:messageId/reactions` | Toggle reaction | 120/min |
| DELETE | `/api/rooms/:id/messages/:messageId` | Author or moderator soft delete | 60/min |
| POST | `/api/rooms/:id/sessions` | Host a shared session | 20/h |
| GET | `/api/rooms/:id/sessions/active` | Current/upcoming session + participants | 240/min |
| POST | `/api/rooms/:id/sessions/:sessionId/join` | Join with declared goal/topic/minutes | 60/h |
| POST | `/api/rooms/:id/sessions/:sessionId/complete` | Submit outcome, award XP | 60/h |
| GET | `/api/rooms/:id/leaderboard?period=daily\|weekly` | Cached room leaderboard | 120/min |
| GET | `/api/rooms/leaderboard` | Room-vs-room rankings | 60/min |

DTO/validation rules live in `models/room.go` (`ValidateRoomInput`,
`SanitizeMessageBody`, `CanModerate`, `MeetsEntryRequirements`, …) so the HTTP layer
stays thin and the rules are unit-testable.

Errors reuse the existing shape: `{"error": "...", "message": "..."}` with
`badRequest`/`serverError` helpers from `handlers/auth.go`.

---

## Phase 4 — Realtime system

`realtime.NotifyRoom(roomID, topic)` appends one event to
`studybuddy:realtime:room:<roomID>` (capped, approx-trimmed, topic only).
`realtime.ReadRoomChanges(ctx, roomID, cursor, block)` long-polls it.
`GET /api/rooms/:id/changes` wraps that read **behind a membership check**, so stream
access is authorized by the same rule as the REST data.

Why this shape:

- **O(1) write fan-out.** One `XAdd` per event regardless of member count. Writing
  per-member (the naive port of the existing per-user stream) would be O(members)
  commands and would blow the free tier's command budget on a 500-member room.
- **No payloads.** Events are topics (`room:<id>:chat`, `:presence`, `:session`).
  Clients refetch authorized REST endpoints, so Redis never holds private content and
  a stream leak cannot leak messages. This is the existing design invariant in
  `handlers/realtime.go` ("carries no document contents"), preserved.
- **Traffic control.** Clients subscribe to **only the room currently open**, not
  every joined room. Presence heartbeats are 30 s, and a heartbeat that does not
  change state does not emit an event (state-change-only notification), which is the
  single biggest traffic reduction available.
- **Graceful disable.** `realtime.Enabled() == false` → endpoint returns
  `{"enabled": false}` and the client falls back to a 30 s refetch interval.

Risk: long-poll holds a Fiber goroutine per active viewer. Mitigation: the same 25 s
bounded block already used for user streams, plus `PoolSize = 5` on the Redis client;
B1 handles this comfortably at expected concurrency, and the fallback path costs
nothing when Redis is absent.

---

## Phase 5 — Mobile strategy

The Android target is the Capacitor shell of this web app, so "mobile-first" is a
**CSS/interaction** problem, not a second codebase:

- Layout is mobile-first Tailwind: single column by default, `sm:`/`lg:` upgrades. No
  fixed pixel widths on containers; long strings get `break-words`/`truncate` so a
  room name cannot cause horizontal scroll (enforced by the repo's existing
  `tests/frontend/ui-responsive-contracts.test.ts` style checks).
- Tap targets ≥ 44 px, and interactive controls are real `<button>`/`<a>` elements.
- Offline: reads fall back to the last snapshot via `apiFetchJSON`'s existing snapshot
  cache; writes that matter offline (presence, outcome submission) are safe to drop
  and retry rather than queue, so we do not grow the outbox with data that is stale on
  arrival. Chat posting requires connectivity and says so, instead of silently
  queueing a message that arrives 40 minutes late.
- Background sync is explicitly **not** promised: the service worker is static-only by
  design (`public/sw.js` never caches `/api`), and the README already documents that
  reminders are foreground-only. Claiming background room sync would be a lie on both
  web and Capacitor.

---

## Phase 6 — UI/UX

Three surfaces, following the existing view/page split (`app/rooms/page.tsx` →
`src/views/StudyRooms.tsx`):

1. **Discovery** — search, category chips, sort; room cards showing members, live
   count, collective hours, tags.
2. **Room detail** — header (name, visibility badge, member/live counts, join/leave),
   then tabs: *Desks* (avatar grid with state + live timer), *Chat*, *Leaderboard*,
   *Sessions*.
3. **Create room** — dialog with visibility choice that reveals goal fields or elite
   requirement fields conditionally.

Design language reuses the shipped tokens (`src/styles/studybuddy-theme.css`,
`dashboard-glass*.css`) and Radix primitives already in `package.json` — no new UI
dependency. Motion uses `framer-motion` with the repo's `src/lib/motion.ts` variants
and respects `prefers-reduced-motion`.

Accessibility: tab lists are Radix/ARIA-correct with keyboard arrow support, the desk
grid is a `ul`/`li` with per-member accessible labels ("Aditi, deep focus, 42 minutes"),
live regions announce session start, all icon-only buttons have `aria-label`, and
focus rings are never removed. Colour is never the only state signal — presence uses
icon + text label alongside the dot.

---

## Phase 7 — Analytics

Aggregation strategy, in order of preference:

1. **Counters on write** (`room_members.studyMinutes`, `study_rooms.totalStudyMinutes`)
   — O(1), always correct enough for ranking.
2. **Cached aggregation** for leaderboards: `cache.GetJSON`/`SetJSON` with the
   existing 120 s leaderboard TTL and shared (non-per-user) keys only, per the rules
   documented in `internal/cache/cache.go`.
3. **On-demand aggregation** for the room analytics dashboard (most active hours,
   average session duration, trends) — deferred, and when built it must write a daily
   rollup document rather than scanning `room_session_participants` per request.

Never: per-request `$lookup` across members, or per-user cache keys (they evict the
shared cache on a 20 MB instance).

---

## Phase 8 — Security

- **AuthN**: cookie-only `connect.sid` via `RequireAuth`; nothing new.
- **AuthZ**: every room route resolves membership first; `CanModerate` /
  `CanAdministerRoom` are pure functions with tests. Private rooms return 404 (not 403)
  to non-members so they are not enumerable.
- **Input validation**: length caps on every string, tag/category allowlists, rune-count
  limits (not byte length) so multi-byte input cannot bypass caps, URL scheme allowlist
  for cover images and resources, ObjectId parsing on every path param.
- **Anti-abuse**: 30 posts/min chat limit, 10 rooms/hour creation limit, duplicate
  consecutive message rejection, mention list capped and de-duplicated, ban state
  blocks both reads and writes.
- **Injection**: all queries are BSON documents built in Go — never string-concatenated.
  User text is stored raw and rendered as text (no `dangerouslySetInnerHTML` on the
  rooms surface).
- **Privacy**: Redis carries topics only; no message content leaves Mongo.
- **Account deletion**: `handlers/account_deletion.go` wipes `room_members`,
  `room_presence`, `room_session_participants`, `room_messages` and
  `room_resources` for the account, decrements each room's `memberCount` first,
  and archives rooms the account owned. Shared documents (`study_rooms`,
  `room_sessions`) are archived rather than deleted because they hold other
  members' data. `TestDeletionWipePlanCoversStudyRoomData` fails if a future room
  collection is added without extending the wipe.
- **Archived rooms are read-only**: `requireWritableRoomMember` gates every write
  (chat, reactions, presence, sessions, edits, role changes). Reads and *leaving*
  stay available so members keep access to their own history.
- **Write-path invariants**: cursor pagination is refused on sort orders whose sort
  key is not the cursor key (it would skip and repeat rows); switching a room to
  private mints an invite code, without which the room would be unjoinable; session
  credit is measured from the participant's own join time, so a late joiner cannot
  claim the whole session.

---

## Phase 9 — Testing

- Backend: table-driven unit tests over the pure domain (`models/room_test.go`) and
  handler-level helper tests (`handlers/rooms_test.go`) in the repo's existing
  DB-free style. Gate: `go vet ./...` and `go test -race ./...`.
- Frontend: `tsx --test` unit tests for the pure client logic (query keys, cursor
  paging, presence formatting, responsive contracts). Gate: `eslint`,
  `tsc --noEmit`, `next build`.
- Both gates are already in `.github/workflows/deploy.yml` / `azure-backend.yml`, so
  rooms are covered by CI without workflow changes.

---

## Phase 10 — Deployment

No new infrastructure. Rooms ship inside the existing backend image
(`ghcr.io/…/studybuddy-api`) and the existing Vercel frontend:

1. Merge to `main` → `azure-backend.yml` vets, tests, builds, pushes, repoints the Web
   App (now using the non-deprecated `--container-image-name` /
   `--container-registry-url` flags).
2. Indexes are created idempotently at boot by `SetupIndexes()`; no migration step and
   no downtime. Existing users see the feature appear with zero data backfill because
   every new collection starts empty and every new user field is additive.
3. Rollback is image re-pin (`SHA=<previous> ./scripts/cloudshell-redeploy.sh`).
   Because the change is additive, rolling back the API leaves no orphaned schema.
4. `REDIS_URL` stays optional. If it is absent in an environment, rooms degrade to
   polling rather than failing readiness.

---

## Deferred work (designed, not built)

These are intentionally **not** implemented in this pass, so nothing here is claimed as
shipped:

- **Resource Vault endpoints/UI** — schema and index are specified above.
- **Room analytics dashboard** — needs the daily rollup collection described in Phase 7.
- **AI study coach / session review / quiz generation** — the abstraction boundary is
  `internal/services/ai.go` (already provider-agnostic); rooms must call it through a
  `RoomCoach` interface so no provider is hardcoded.
- **Invitations / join requests for private rooms** — currently private rooms are
  joinable only by direct invite code, and approval queues are future work. The
  `pending` member status exists in the model for that flow but is not yet reachable
  through any endpoint.
- **Levels UI** — XP is awarded and stored; the level curve is a pure function ready to
  surface.
- **Owner-facing moderation UI** — the transfer-ownership, restore-room, member
  promote/demote/ban and pin-message endpoints all exist and are tested, but the
  client only surfaces message deletion so far.
- **Known residual issues** (deliberately not fixed in this pass, none of them
  data-destroying): `memberCount` is denormalized and can drift from the true
  `room_members` count if a write fails midway — it is a display value, not an
  authorization input, and a periodic reconciliation job is the right fix;
  discovery's `q` search runs an anchored regex that cannot use the tag/category
  index, so it should be debounced client-side or moved to an Atlas Search index
  before it is promoted in the UI; and room XP is added to `users.totalPoints`,
  which means the global leaderboard includes room activity by design.
