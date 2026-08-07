# Product feature coverage

This matrix compares the authenticated reference-product behavior inspected during the redesign with the current StudyBuddy implementation. It describes behavior only; no proprietary source, assets, credentials, or private account data were copied.

Status meanings:

- **Full** — StudyBuddy supports the core workflow end to end.
- **Partial** — related behavior exists, but one or more reference workflows are still missing.
- **Deferred** — intentionally not implemented in this delivery.

## Goals and consistency

| Feature | StudyBuddy status | Current StudyBuddy behavior | Remaining difference |
|---|---|---|---|
| Custom goals | **Full** | Protected goal creation, title/description, start date, optional target date | None for the core workflow |
| Goal templates | **Full** | JEE revision, NEET practice, UPSC consistency, GATE problems, CAT sprint, plus custom | Templates are StudyBuddy-specific rather than copied |
| Target-date goals | **Full** | Start and target dates with server validation | None |
| Open-ended habits | **Full** | Nullable target date | None |
| Daily/weekly cadence | **Full** | Goal grid mode is stored and editable | Calendar presentation is StudyBuddy-native |
| Sub-goals | **Full** | Add, edit, remove, reorder; daily completion history is generation-fenced | None |
| Milestones | **Full** | Add, rename, target date, complete, clear date, remove, reorder | None |
| Automatic completion | **Full** | A day auto-shows-up only when every current sub-goal is complete | None |
| Manual/partial show-up | **Full** | Partial sub-goals and explicit manual show-up with manual precedence | None |
| Goal lifecycle | **Full** | Active, completed, archived, restored, and permanent removal | Standalone Mongo deletion may return cleanup-pending while hidden safely |
| Safe concurrent edits | **Full** | Definition-version fence prevents stale activity from affecting current results | None |

## Calendar and statistics

| Feature | StudyBuddy status | Current StudyBuddy behavior | Remaining difference |
|---|---|---|---|
| Monday–Sunday calendar | **Full** | Responsive 84-day bounded calendar with weekly rows | Reference can render an entire long goal at once; StudyBuddy deliberately bounds requests |
| Past/today/future states | **Full** | Pre-start and future dates disabled; past and today actionable | None |
| Daily checklist sheet | **Full** | Accessible dialog with per-sub-goal none/partial/complete controls | None |
| Visual progress cells | **Full** | Empty, partial, and complete states | StudyBuddy-native colors/icons |
| Momentum | **Full** | Weighted complete/partial score over eligible periods | Formula is StudyBuddy-owned |
| Momentum target | **Full** | Weekly target slider and persisted check-in | None |
| Current streak | **Full** | Daily or weekly cadence-aware streak; open current period does not break it | None |
| Best streak | **Full** | Best historical run within the bounded range | None |
| Weekday pattern | **Full** | Monday–Sunday eligible, partial, complete, and completion-rate values | None |
| Timezone handling | **Full** | Browser/profile timezone is sent and validated; date boundaries are location-aware | None |

## Tasks, journal, mentor, and guidance

| Feature | StudyBuddy status | Current StudyBuddy behavior | Remaining difference |
|---|---|---|---|
| Quick tasks | **Full** | Dedicated `/tasks`, Enter to add, complete, delete, filter, optimistic writes | StudyBuddy also supports subject, difficulty, dates, and rescheduling |
| Task performance | **Full** | Filter-aware optimistic cache, entity-safe rollback, authoritative background reconciliation | None |
| Date journal/log | **Full** | Protected date-indexed journal with previous/next/day picking, debounced autosave, revision-conflict handling, and local crash drafts | Authenticated entries remain network-only |
| Rich formatting | **Full** | Markdown toolbar for bold, italic, strikethrough (the underline alternative), inline code (the highlight alternative), links, bulleted lists, and numbered lists, with preview | StudyBuddy uses safe Markdown rather than a copied editor |
| Image in journal | **Full** | Private JPEG/PNG/GIF attachment upload, insertion, revision binding, and deletion | 1 MiB per-image limit and bounded references are deliberate |
| Dictation | **Full** | Browser SpeechRecognition inserts final transcripts locally and explains unsupported, denied, or failed states while preserving typing fallback | Browser support varies; StudyBuddy does not upload audio |
| Context-aware mentor/coach | **Full** | Read-only Mentor uses bounded goals, current-definition show-ups, tasks, sessions, reports, and optional recent journal context | Thread is ephemeral and Mentor cannot mutate account data |
| Prompt suggestions | **Full** | Dedicated Mentor question chips cover daily focus, missed-day recovery, consistency review, and next-session planning | Suggestions are StudyBuddy-specific |
| Help/guide | **Full** | Protected product/PWA guide plus support, About, and FAQ content | Presentation differs |

## Motivation and personalization

| Feature | StudyBuddy status | Current StudyBuddy behavior | Remaining difference |
|---|---|---|---|
| General streak | **Full** | Existing StudyBuddy streak and analytics plus goal-specific streaks | None |
| Achievement badges | **Full** | Dedicated gallery for 3/5/7/14/30/60/100/365-day streak and completed-goal milestones | Achievement rules are StudyBuddy-owned |
| Completed-goal badges | **Full** | Completed-goal milestones appear in the protected achievement gallery | None for the core workflow |
| Home widgets | **Full** | Allowlisted server-backed order and visibility controls for independently placeable overview and compact widgets, with pointer/keyboard reordering | Fixed overlay timer and the inseparable task/activity workspace are intentionally not advertised as reorderable |
| Daily brief | **Full** | Compact daily task-completion and efficiency summary | Summary is deterministic rather than AI-generated |
| Quick show-up widget | **Full** | One server-side all-active-goals action records complete or partial status and reports every per-goal result | Successful goal activity/stat caches reconcile immediately; no client 100-goal truncation |
| Theme | **Full** | Light/dark themes | None |
| Display name/profile | **Full** | Profile settings | None |
| Timezone | **Full** | Profile timezone and request timezone support | None for goal/calendar calculations |
| Accent palette | **Full** | Fourteen finite accessible accents share one frontend control/normalizer, CSS mapping, and backend allowlist | Palette is intentionally bounded |
| Font selection | **Full** | Sans, mono, and serif preferences are server-backed and applied before paint | None |
| Show-up reminders | **Full** | Timezone/day-aware foreground reminders with versioned per-user/per-date dedupe and explicit Settings-only notification permission | Works only while StudyBuddy is open; no closed-app/background delivery guarantee |
| PWA installation | **Full** | Manifest, generated icons, safe prompt capture, protected platform guide, and static-only service worker | Only versioned public assets are cached; navigation HTML, API/auth/private data, schedules, and AI remain network-only |

## Delivery priority after this release

1. Continue accessibility and target-browser verification for journal dictation, notifications, and PWA installation.
2. Evaluate richer daily summaries without sending additional personal context to AI providers by default.
3. Add background reminders only if a separately reviewed push-notification architecture and consent model are introduced.

The goal/calendar and personalization foundations are complete and safe to extend without changing the core domain model.
