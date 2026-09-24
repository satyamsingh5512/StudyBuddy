import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

test('Digital Discipline uses a typed, native-only Capacitor contract with explicit control levels', async () => {
  const source = await read('src/lib/digitalDiscipline.ts');
  assert.match(source, /registerPlugin<NativeDigitalDisciplinePlugin>\('DigitalDiscipline'\)/);
  assert.match(source, /isNativeApp\(\) && getPlatform\(\) === 'android'/);
  assert.match(source, /type DeviceControlLevel = 'STANDARD' \| 'CONSUMER' \| 'MANAGED'/);
  assert.match(source, /interface FocusSession/);
  assert.match(source, /interface DigitalUsageSummary/);
  assert.match(source, /interface StudyRoomFocusSession/);
  assert.match(source, /interface DigitalDisciplineSyncStatus/);
});

test('consumer wording and native implementation do not claim unmanaged phone control', async () => {
  const [dashboard, service, managed] = await Promise.all([
    read('src/views/DigitalDiscipline.tsx'),
    read('resources/android/digitaldiscipline/ConsumerEnforcementService.kt'),
    read('resources/android/digitaldiscipline/ManagedDevice.kt'),
  ]);
  assert.match(dashboard, /does not force-stop the app/);
  assert.match(dashboard, /Device Owner provisioning is a separate administrative process/);
  assert.match(service, /never reads screen text, clicks\n \* another app, changes device settings, force-stops, or suspends a package/);
  assert.doesNotMatch(service, /AccessibilityService/);
  assert.match(managed, /isDeviceOwner\(\)/);
  assert.match(managed, /requireOwner\(\)/);
});

test('native source persists the requested local-first entities and deterministic intervention boundaries', async () => {
  const [database, engine, script] = await Promise.all([
    read('resources/android/digitaldiscipline/DigitalDisciplineDatabase.kt'),
    read('resources/android/digitaldiscipline/Contracts.kt'),
    read('scripts/prepare-android.mjs'),
  ]);
  for (const entity of [
    'UserLocalProfileEntity', 'FocusSessionEntity', 'FocusSessionEventEntity', 'FocusConfigurationEntity',
    'ProtectedAppEntity', 'DoomscrollRuleEntity', 'DoomscrollEventEntity', 'InterventionEventEntity',
    'BlockedAttemptEntity', 'UsageApplicationEntity', 'UsageSnapshotEntity', 'DailyUsageSummaryEntity',
    'WeeklyUsageSummaryEntity', 'StudyRoomEntity', 'StudyRoomPresenceEntity', 'RoomFocusSessionEntity',
    'DigitalDisciplineSettingsEntity', 'AllowedApplicationEntity', 'UnlockCredentialMetadataEntity',
    'AchievementEntity', 'ProductivityMetricEntity', 'SyncQueueItemEntity',
  ]) assert.match(database, new RegExp(`data class ${entity}`));
  assert.match(engine, /object DoomscrollScorer/);
  assert.match(engine, /intervene_or_managed_block/);
  assert.match(script, /androidx\.room:room-runtime:2\.6\.1/);
  assert.match(script, /androidx\.datastore:datastore-preferences:1\.1\.1/);
  assert.match(script, /androidx\.work:work-runtime-ktx:2\.9\.0/);
  assert.match(script, /DigitalDisciplinePlugin/);
});
