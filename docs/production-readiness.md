# Production readiness

Last reviewed: 31 July 2026

## Current status

The repository production-readiness roadmap has been implemented without replacing established study, scheduling, analytics, social, or authentication business logic. The application now has hardened request semantics, cookie-only revocable sessions, abuse controls, bounded backend access patterns, accessible activation flows, static public-route delivery, automated release gates, and focused security regression tests.

This is a code-readiness statement, not evidence that a specific deployment is ready. Cross-site cookie behavior, OAuth/email/AI integrations, MongoDB operations, backups, monitoring, and critical user journeys still require verification in the target infrastructure and real browsers before release.

## Shipped architecture and security

### Browser sessions and request integrity

- Browser authentication uses only the `connect.sid` HttpOnly cookie. Session tokens are not returned in JSON, placed in OAuth URLs, stored in browser storage, or accepted from bearer headers.
- Session JWT issuance and parsing are centralized in `backend/internal/session`. Tokens use HS256, require expiration, and carry the persisted user `sessionVersion`.
- Auth middleware loads the current user and rejects otherwise-valid tokens whose version has been revoked. Logout and password reset increment `sessionVersion`, currently signing the account out on every device.
- `SESSION_SECRET` is mandatory, must contain at least 32 bytes, and has no fallback. Rotating it invalidates all sessions.
- Production cookies are `Secure; HttpOnly; SameSite=None; Path=/`. Browser API traffic uses the app's same-origin `/api` proxy so privacy controls do not classify the session as a third-party cookie; trusted-origin checks still protect state-changing calls at the backend.
- Frontend requests use `credentials: include`. React Query owns safe query caching/deduplication, while mutations are independent and are not automatically retried.

### Authentication abuse controls

- Emails are normalized and validated on the backend; passwords are limited to 8–72 characters.
- Verification and reset codes are generated with `crypto/rand`; only bcrypt hashes are stored.
- Login lockouts and verification/reset attempt counters are persisted in MongoDB.
- Public auth, authenticated AI, and message routes have bounded fixed-window quotas with `Retry-After` responses.
- Signup and account-recovery responses avoid disclosing whether an account exists.

The general route limiter is process-local. MongoDB-backed account lockouts remain effective across API instances, but per-IP and authenticated route quotas are not globally coordinated. A shared rate-limit store is required before horizontally scaling into a threat model that depends on exact global quotas.

### Authorization, data access, and operations

- Direct messages require a valid recipient, accepted friendship, and no block relationship. Content and file URLs are bounded.
- Message history is sorted, limited, and cursor-paginated. Conversation summaries use batched users and MongoDB aggregation rather than per-friend queries.
- Compound indexes cover direct messages, friend requests, blocks, todos, notes, timers, reports, and user lookup patterns. Block writes are atomic idempotent upserts.
- Todo and note collections return bounded, deterministic result sets. AI endpoints have account quotas; AI news cache storage is bounded; cache clearing is admin-only.
- The API has request IDs, panic recovery, security headers, CORS with credentials, a 2 MiB body limit, read/write/idle timeouts, and graceful shutdown.
- `/api/health/live` reports process liveness. `/api/health/ready` and `/api/health` verify MongoDB readiness.

## Shipped frontend and accessibility work

- Public and legal routes render while cookie authentication resolves. Protected routes alone show the auth bootstrap loading state.
- Global forced dynamic rendering was removed. The production build prerenders every route except `/messages/[userId]`.
- Inter, Outfit, and JetBrains Mono are delivered through `next/font`; render-blocking Google font links were removed.
- The routed auth experience includes persistent labels, autocomplete metadata, verification, recovery, password visibility names, and legal links.
- The authenticated shell includes skip navigation, current-route semantics, labeled mobile controls, and a closed drawer removed from the focus order.
- Onboarding announces three-step progress and exposes avatar selections as pressed controls.
- Dashboard task controls are named and keyboard reachable; drag-and-drop supports keyboard reordering. Missing exam dates no longer display a false zero-day countdown.
- Unsupported marketing metrics and testimonials were removed. The privacy notice now describes account, study, social, analytics, AI, cookie, vendor, retention, and deletion behavior.

Existing remote/avatar `<img>` lint warnings remain. Conversion to `next/image` should be done only with an explicit remote-host policy and verified image behavior.

## Dependencies and delivery

- The frontend is pinned to Next.js 16.2.12, React 18, UUID 14.0.1, ESLint 9.39.5, and eslint-config-next 16.2.12.
- Sharp is overridden to patched version 0.35.3. Tailwind-only packages are classified as development dependencies.
- Build-time type and lint suppression has been removed. ESLint uses the supported flat configuration and the production build checks TypeScript.
- CI uses Node 20.19.6 and Go 1.24. It runs frontend lint, TypeScript, build, and critical production audit gates plus backend race tests, vet, and build.
- Staging and production deploy hooks fail on HTTP errors. Deployment checks use `curl --fail` against `/api/health/ready`.

### Accepted upstream dependency exception

`npm audit --omit=dev` currently reports one high and two moderate findings, all chained from the PostCSS 8.4.31 copy bundled inside every current stable Next.js release. The advisories concern CSS stringification and attacker-controlled source-map comments. StudyBuddy does not accept user-controlled CSS or source maps into its build, and forcing npm's suggested Next.js 9 downgrade would be unsafe. CI therefore blocks critical production findings while this exception is tracked. Upgrade Next as soon as a stable release ships a fixed bundled PostCSS version, then restore the stricter audit threshold.

## Deployment contract

Required backend settings:

- `MONGODB_URI`
- `SESSION_SECRET` with at least 32 random bytes
- `NODE_ENV=production`
- The exact frontend origin in `CLIENT_URL`, `NEXT_PUBLIC_APP_URL`, or comma-separated `ALLOWED_ORIGINS`

Required frontend settings:

- `BACKEND_API_URL`, including the `/api` prefix; this server-only value is the target of the Next.js `/api` proxy
- `NEXT_PUBLIC_APP_URL`, preferably as a full HTTPS origin

`NEXT_PUBLIC_API_URL` remains a compatibility fallback for selecting the server-side proxy target, but browser code no longer calls that cross-site URL directly.

Optional integrations use `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, provider model variables, email provider credentials, and admin identity variables where those features are enabled.

The backend may be hosted on another site, but browsers must call only the app's HTTPS, same-origin `/api` path. The API must emit `Secure` cookies, frontend fetches must include credentials, and CORS/trusted-origin middleware must recognize the exact app origin forwarded by the proxy. For Google OAuth, register `https://<app-origin>/api/auth/google/callback` as an authorized redirect URI; set `GOOGLE_CALLBACK_URL` to that exact value or leave it unset so `CLIENT_URL` is used. Validate signup, verification, password login, refresh-on-navigation, OAuth callback, unsafe mutations, logout, and password reset in every supported target browser. CLI requests do not validate browser cookie policy.

## Release validation

Run from the repository root unless a directory is shown:

```bash
npm ci --include=dev
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev

cd backend
go test -race ./...
go vet ./...
go build ./...

cd ..
git diff --check
```

The audit command is expected to exit non-zero only for the documented bundled PostCSS chain. Any new critical finding, any finding outside that chain, or an increase in exposure requires review before release.

## Remaining external and follow-up work

1. Run browser end-to-end tests for authentication, onboarding, task management, messaging authorization, and password-reset session revocation against staging.
2. Add deterministic MongoDB integration tests for tenant boundaries, message aggregation/pagination, indexes, and session-version rejection. Current session, credential, rate-limit, and origin tests do not replace database integration coverage.
3. Verify OAuth, transactional email, AI provider budgets/failure modes, admin identity, analytics consent expectations, and privacy text in each deployment region.
4. Configure production logs/metrics/alerts, MongoDB backups and restore drills, secret rotation, incident response, uptime checks, and capacity/load testing.
5. Replace process-local route quotas with a shared store before multi-instance enforcement is required.
6. Measure Core Web Vitals and route bundles with production traffic before further dashboard splitting or remote-image optimization.
7. Obtain appropriate product, privacy, and legal review for the actual commercial deployment and vendor contracts.
