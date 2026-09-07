# StudyBuddy Android APK (Capacitor)

StudyBuddy builds as a Capacitor Android shell around `https://sbd.satym.in`. The current debug APK is produced from the web app plus versioned Android preparation sources; generated `android/` output remains ignored.

## Verified build

Use Node 20.x (the package engine range), Java 17, and an installed Android SDK:

```bash
cd StudyBuddy
npm ci
JAVA_HOME=/path/to/jdk17 npm run apk:debug
```

`apk:debug` runs Capacitor sync, reapplies tracked native customization, and runs Gradle from `android/`. The artifact is:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

A successful debug build was verified in this workspace using the repository-local Java 17 toolchain. It is unsigned/debug-only; release signing, keystore custody, Play policy declarations, and device testing remain the release owner's responsibility.

## Offline behavior and synchronization

- While signed in, successful GET responses can be kept as local snapshots and supported Todo/timer writes are queued durably with stable `clientMutationId` values.
- The outbox is FIFO. It stops at any failed entry, records attempts/errors, preserves auth/conflict/validation failures for repair, treats an already-deleted Todo as idempotent, and rewrites a temporary offline Todo ID after its server create succeeds.
- Timer and Todo creates carry the same mutation ID on their first request and any replay. Todo update/delete requests also retain a stable replay ID; those updates are value-setting operations, so retrying them converges to the same state.
- Reconnect, Capacitor network changes, app resume, and periodic sync retry queued operations.
- Explicit logout clears snapshots, queued writes, focus markers, tab drafts, and StudyBuddy cache on that device. This intentionally discards unsynced writes rather than allowing one account's data to replay under another account.

### Important limitation

Because Capacitor currently loads a **remote** Next deployment, a first-ever offline launch cannot load the full authenticated app. The service worker only caches public static assets and `/offline.html`; it intentionally does not cache account navigation HTML. After an online session is already open, cached reads and queued supported writes remain usable during a transport outage. AI, social, news, and live server features still require connectivity.

## Android reminders

- Local Notifications create a dedicated `studybuddy-alarms` channel and schedule up to seven days of task reminders.
- `scripts/prepare-android.mjs` adds `SCHEDULE_EXACT_ALARM` and the notification icon after every Capacitor sync.
- The Settings page exposes an Android exact-alarm action. Android 12+ requires the user to grant that scheduling capability, and OEM battery policies can still delay notifications.
- Browser reminders remain foreground/web best-effort; Android local alarms are the background-capable path.

## Cross-device focus and phone-use interruption

Focus state is server-authoritative and guarded by same-device identifiers. A phone using StudyBuddy's own timer/clock is exempt. Web UI polling remains a safe baseline.

The APK additionally offers a **disabled-by-default Android phone-wide focus guard** in Settings. Enabling it requires a clear user disclosure plus Android's Usage Access and “Display over other apps” grants. Its foreground service:

1. checks only the current foreground package while a remote focus session is active;
2. ignores StudyBuddy itself;
3. shows a visible reminder overlay with an **Open StudyBuddy timer** action; and
4. ends the StudyBuddy focus session after 150 seconds of continued external phone use.

It does not record app history, use Accessibility, lock the device, force-stop apps, or bypass Android settings. Android device-owner/MDM enrollment would be required for actual system-wide locking or app blocking. The native service is pinned to `https://sbd.satym.in/api`, stores no session cookie in JavaScript, and generated builds disable Android backup for its preferences.

## Optional Redis realtime synchronization

- Set `REDIS_URL` only when Redis Streams-based cross-device change notifications are wanted. Events contain only a topic and timestamp; clients refetch authorized REST resources. If Redis is absent or unreachable, MongoDB and existing polling continue normally.
- This codebase does **not** include Redis response caching, PostgreSQL migrations, a PostgreSQL importer, or a database cutover path. MongoDB remains the active datastore.

## Validation checklist

```bash
npx tsc --noEmit
npm run lint
npm run test:frontend
npm run build
(cd backend && go test ./...)
JAVA_HOME=/path/to/jdk17 npm run apk:debug
```

Manual device checks: notification permission + exact alarm; task reminder while backgrounded; airplane-mode Todo/timer write then reconnect; explicit logout with no prior-account offline data visible; laptop focus then phone guard; same-app timer exemption; 150-second interruption; portrait and short-landscape fullscreen timer.
