import { registerPlugin } from '@capacitor/core';
import { getPlatform, isNativeApp } from '@/lib/capacitor';

/** Stable web-to-native contract for the StudyBuddy Digital Discipline Engine. */
export type DeviceControlLevel = 'STANDARD' | 'CONSUMER' | 'MANAGED';
export type FocusMode = 'NORMAL' | 'STRICT' | 'HARDCORE' | 'SHARED_ROOM' | 'POMODORO' | 'DEEP_WORK' | 'CUSTOM';
export type FocusState =
  | 'IDLE'
  | 'CONFIGURING'
  | 'READY'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'INTERRUPTED'
  | 'SYSTEM_INTERRUPTION';
export type ProtectedAppPolicy = 'ALLOW' | 'WARN' | 'INTERVENE' | 'BLOCK';
export type SyncState = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface FocusSession {
  active: boolean;
  id?: string;
  state: FocusState;
  mode?: FocusMode;
  durationMs?: number;
  elapsedMs?: number;
  subject?: string;
  controlLevel?: DeviceControlLevel;
  interruptionReason?: string | null;
  startedAtMs?: number;
}

export interface FocusConfiguration {
  mode: FocusMode;
  durationMinutes: number;
  subject?: string;
  controlLevel: DeviceControlLevel;
}

export interface DigitalUsageSummary {
  available: boolean;
  explanation?: string;
  localDate?: string;
  screenTimeMs?: number;
  studyTimeMs?: number;
  focusTimeMs?: number;
  distractionTimeMs?: number;
  doomscrollTimeMs?: number;
  blockedAttempts?: number;
  interventions?: number;
  /** An explicit estimate based only on completed configured interventions. */
  estimatedRecoveredMs?: number;
  updatedAtMs?: number;
  /** Screen unlocks that day. Absent when the device cannot report it (Android 8.1 and below). */
  unlockCount?: number;
}

export interface DailyUsageHistory {
  available: boolean;
  explanation?: string;
  /** Newest first. Days the device has no record of are absent, never zero-filled. */
  days: DigitalUsageSummary[];
  daysImported: number;
  oldestImportedDate?: string;
  /** True when the oldest retained day looked cut off by the platform and was skipped. */
  truncatedOldestDropped: boolean;
}

export interface AppUsageEntry {
  packageName: string;
  label: string;
  category: string;
  foregroundMs: number;
}

export interface ProtectedApplication {
  packageName: string;
  displayName?: string;
  category:
    | 'PRODUCTIVITY'
    | 'EDUCATION'
    | 'SOCIAL'
    | 'ENTERTAINMENT'
    | 'COMMUNICATION'
    | 'DEVELOPMENT'
    | 'FINANCE'
    | 'OTHER';
  policy: ProtectedAppPolicy;
  scheduleType: 'ALWAYS' | 'SCHOOL_HOURS' | 'STUDY_HOURS' | 'FOCUS_SESSIONS' | 'NIGHT' | 'CUSTOM';
  customScheduleJson?: string;
}

export interface AntiDoomscrollSettings {
  enabled: boolean;
  rules: Array<{
    packageName: string;
    threshold: number;
    policy: ProtectedAppPolicy;
    weights?: Partial<Record<DoomscrollSignal, number>>;
  }>;
}

export type DoomscrollSignal =
  | 'surface_entry'
  | 'repeated_navigation'
  | 'rapid_transition'
  | 'duration_threshold'
  | 'repeat_after_intervention'
  | 'blocked_attempt';

export interface DoomscrollEvaluation {
  score: number;
  threshold: number;
  triggered: boolean;
  requestedPolicy: ProtectedAppPolicy;
  effectiveAction: 'allow' | 'warn' | 'intervene' | 'intervene_or_managed_block';
  reasons: string[];
}

export interface StudyRoomFocusSession {
  roomId: string;
  serverSessionId: string;
  startsAtMs: number;
  durationMinutes: number;
  topic?: string;
}

export interface ProductivityMetrics {
  focusCompletionRate?: number;
  averageSessionMs?: number;
  longestFocusMs?: number;
  estimatedRecoveredMs?: number;
}

export interface DigitalDisciplineDiagnostics {
  androidVersion: string;
  apiLevel: number;
  manufacturer: string;
  model: string;
  usageAccess: boolean;
  overlay: boolean;
  notifications: boolean;
  batteryOptimizationsIgnored: boolean;
  accessibility: 'NOT_USED';
  deviceOwner: boolean;
  lockTask: boolean;
  packageSuspension: boolean;
  backgroundExecution: boolean;
  nativePlugin: boolean;
  secureCredentialStorage: boolean;
  controlLevel: DeviceControlLevel;
  consumerMonitoringEnabled: boolean;
  /** Whether the draggable focus bubble is currently running over other apps. */
  focusBubbleEnabled: boolean;
  featureFlags: DigitalDisciplineFeatureFlags;
}

export interface DigitalDisciplineFeatureFlags {
  usageAnalytics: boolean;
  antiDoomscroll: boolean;
  strictFocus: boolean;
  hardcoreFocus: boolean;
  studyRoomFocus: boolean;
  managedDeviceMode: boolean;
  /** Reserved for a future declared service; no AccessibilityService is currently registered. */
  accessibilityIntegration: boolean;
}

export interface DigitalDisciplineSyncStatus {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  uploadsEnabled: boolean;
  explanation: string;
}

interface NativeDigitalDisciplinePlugin {
  getCapabilities(): Promise<unknown>;
  getPermissionStatus(): Promise<unknown>;
  openUsageAccessSettings(): Promise<unknown>;
  openOverlaySettings(): Promise<unknown>;
  openNotificationSettings(): Promise<unknown>;
  openBatteryOptimizationSettings(): Promise<unknown>;
  setFeatureFlags(options: { userId: string; flags: Partial<DigitalDisciplineFeatureFlags> }): Promise<unknown>;
  setConsumerMonitoring(options: { userId: string; enabled: boolean }): Promise<unknown>;
  startFocus(options: { userId: string } & FocusConfiguration): Promise<unknown>;
  pauseFocus(options: { userId: string }): Promise<unknown>;
  resumeFocus(options: { userId: string }): Promise<unknown>;
  completeFocus(options: { userId: string }): Promise<unknown>;
  interruptFocus(options: { userId: string; reason: string }): Promise<unknown>;
  getFocusStatus(options: { userId: string }): Promise<unknown>;
  saveProtectedApps(options: { userId: string; apps: ProtectedApplication[] }): Promise<unknown>;
  getProtectedApps(options: { userId: string }): Promise<unknown>;
  getDailyUsageSummary(options: { userId: string }): Promise<unknown>;
  getDailyUsageHistory(options: { userId: string; days?: number }): Promise<unknown>;
  getAppUsageForDay(options: { userId: string; localDate: string }): Promise<unknown>;
  getWeeklyUsageSummaries(options: { userId: string; weeks?: number }): Promise<unknown>;
  setProgressNotifications(options: { userId: string; enabled: boolean }): Promise<unknown>;
  getProgressState(options: { userId: string }): Promise<unknown>;
  evaluateDoomscroll(options: {
    userId: string;
    policy: ProtectedAppPolicy;
    threshold?: number;
    signals: Partial<Record<DoomscrollSignal, number>>;
  }): Promise<unknown>;
  configureUnlockCredential(options: { userId: string; credential: string; biometricAllowed: boolean }): Promise<unknown>;
  verifyUnlockCredential(options: { userId: string; credential: string }): Promise<unknown>;
  joinRoomFocus(options: { userId: string } & StudyRoomFocusSession): Promise<unknown>;
  getManagementStatus(): Promise<unknown>;
  configureManagedFocus(options: { allowedPackages: string[] }): Promise<unknown>;
  enterManagedFocusMode(options: { allowedPackages: string[] }): Promise<unknown>;
  exitManagedFocusMode(): Promise<unknown>;
  deleteUsageData(options: { userId: string }): Promise<unknown>;
  clearFocusHistory(options: { userId: string }): Promise<unknown>;
  disableMonitoring(): Promise<unknown>;
  getSyncStatus(options: { userId: string }): Promise<unknown>;
  refreshWidgets(): Promise<unknown>;
  syncNativeAlarms(options: { alarms: NativeAlarmSpec[] }): Promise<unknown>;  cancelNativeAlarm(options: { id: number }): Promise<unknown>;
  listNativeAlarms(): Promise<unknown>;
  setFocusBubble(options: { enabled: boolean }): Promise<unknown>;
  setFocusGoal(options: { userId: string; dailyMinutes: number }): Promise<unknown>;
  addListener(
    eventName: 'focusStateChanged',
    listenerFunc: (state: FocusSession) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const NativeDigitalDiscipline = registerPlugin<NativeDigitalDisciplinePlugin>('DigitalDiscipline');

const nativePlugin = (): NativeDigitalDisciplinePlugin | null =>
  isNativeApp() && getPlatform() === 'android' ? NativeDigitalDiscipline : null;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const bool = (value: unknown, fallback = false): boolean => typeof value === 'boolean' ? value : fallback;
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const text = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;

function parseFocus(value: unknown): FocusSession {
  const data = record(value);
  const state = text(data.state);
  const valid: FocusState[] = ['IDLE', 'CONFIGURING', 'READY', 'ACTIVE', 'PAUSED', 'COMPLETING', 'COMPLETED', 'INTERRUPTED', 'SYSTEM_INTERRUPTION'];
  return {
    active: bool(data.active),
    state: state && valid.includes(state as FocusState) ? (state as FocusState) : 'IDLE',
    id: text(data.id),
    mode: text(data.mode) as FocusMode | undefined,
    durationMs: number(data.durationMs),
    elapsedMs: number(data.elapsedMs),
    subject: text(data.subject),
    controlLevel: text(data.controlLevel) as DeviceControlLevel | undefined,
    interruptionReason: text(data.interruptionReason) ?? null,
    startedAtMs: number(data.startedAtMs),
  };
}

function parseDiagnostics(value: unknown): DigitalDisciplineDiagnostics {
  const data = record(value);
  const flags = record(data.featureFlags);
  return {
    androidVersion: text(data.androidVersion) ?? 'unknown',
    apiLevel: number(data.apiLevel) ?? 0,
    manufacturer: text(data.manufacturer) ?? 'unknown',
    model: text(data.model) ?? 'unknown',
    usageAccess: bool(data.usageAccess),
    overlay: bool(data.overlay),
    notifications: bool(data.notifications),
    batteryOptimizationsIgnored: bool(data.batteryOptimizationsIgnored),
    accessibility: 'NOT_USED',
    deviceOwner: bool(data.deviceOwner),
    lockTask: bool(data.lockTask),
    packageSuspension: bool(data.packageSuspension),
    backgroundExecution: bool(data.backgroundExecution),
    nativePlugin: bool(data.nativePlugin),
    secureCredentialStorage: bool(data.secureCredentialStorage),
    controlLevel: (text(data.controlLevel) as DeviceControlLevel) ?? 'STANDARD',
    consumerMonitoringEnabled: bool(data.consumerMonitoringEnabled),
    focusBubbleEnabled: bool(data.focusBubbleEnabled),
    featureFlags: {
      usageAnalytics: bool(flags.usageAnalytics),
      antiDoomscroll: bool(flags.antiDoomscroll),
      strictFocus: bool(flags.strictFocus),
      hardcoreFocus: bool(flags.hardcoreFocus),
      studyRoomFocus: bool(flags.studyRoomFocus),
      managedDeviceMode: bool(flags.managedDeviceMode),
      accessibilityIntegration: bool(flags.accessibilityIntegration),
    },
  };
}

function parseUsageSummary(value: unknown): DigitalUsageSummary {
  const data = record(value);
  return {
    available: bool(data.available),
    explanation: text(data.explanation),
    localDate: text(data.localDate),
    screenTimeMs: number(data.screenTimeMs),
    studyTimeMs: number(data.studyTimeMs),
    focusTimeMs: number(data.focusTimeMs),
    distractionTimeMs: number(data.distractionTimeMs),
    doomscrollTimeMs: number(data.doomscrollTimeMs),
    blockedAttempts: number(data.blockedAttempts),
    interventions: number(data.interventions),
    estimatedRecoveredMs: number(data.estimatedRecoveredMs),
    updatedAtMs: number(data.updatedAtMs),
    unlockCount: number(data.unlockCount),
  };
}

function parseProtectedApplications(value: unknown): ProtectedApplication[] {
  const apps = record(value).apps;
  if (!Array.isArray(apps)) return [];
  return apps.flatMap((candidate) => {
    const app = record(candidate);
    const packageName = text(app.packageName);
    const policy = text(app.policy);
    if (!packageName || !['ALLOW', 'WARN', 'INTERVENE', 'BLOCK'].includes(policy ?? '')) return [];
    return [{
      packageName,
      displayName: text(app.displayName),
      category: (text(app.category) as ProtectedApplication['category']) ?? 'OTHER',
      policy: policy as ProtectedAppPolicy,
      scheduleType: (text(app.scheduleType) as ProtectedApplication['scheduleType']) ?? 'FOCUS_SESSIONS',
      customScheduleJson: text(app.customScheduleJson),
    }];
  });
}

function assertUserId(userId: string): void {
  if (!userId.trim()) throw new Error('A signed-in StudyBuddy user is required.');
}

export function isDigitalDisciplineNativeAvailable(): boolean {
  return nativePlugin() !== null;
}

export async function getDigitalDisciplineDiagnostics(): Promise<DigitalDisciplineDiagnostics | null> {
  const plugin = nativePlugin();
  return plugin ? parseDiagnostics(await plugin.getCapabilities()) : null;
}

export async function openDigitalDisciplinePermission(
  permission: 'usage' | 'overlay' | 'notifications' | 'battery'
): Promise<DigitalDisciplineDiagnostics | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  // Must stay a switch, not an object literal keyed by `permission`: building
  // such a literal calls every branch, which previously fired all four settings
  // intents at once (stacking four Settings screens) and produced unhandled
  // rejections for the three that were discarded.
  switch (permission) {
    case 'usage':
      return parseDiagnostics(await plugin.openUsageAccessSettings());
    case 'overlay':
      return parseDiagnostics(await plugin.openOverlaySettings());
    case 'notifications':
      return parseDiagnostics(await plugin.openNotificationSettings());
    case 'battery':
      return parseDiagnostics(await plugin.openBatteryOptimizationSettings());
    default:
      return null;
  }
}

export async function setDigitalDisciplineFeatureFlags(
  userId: string,
  flags: Partial<DigitalDisciplineFeatureFlags>
): Promise<DigitalDisciplineDiagnostics | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? parseDiagnostics(await plugin.setFeatureFlags({ userId, flags })) : null;
}

export async function setConsumerDigitalDisciplineMonitoring(userId: string, enabled: boolean): Promise<DigitalDisciplineDiagnostics | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? parseDiagnostics(await plugin.setConsumerMonitoring({ userId, enabled })) : null;
}

export async function startNativeFocus(userId: string, configuration: FocusConfiguration): Promise<FocusSession | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? parseFocus(await plugin.startFocus({ userId, ...configuration })) : null;
}

export async function pauseNativeFocus(userId: string): Promise<FocusSession | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? parseFocus(await plugin.pauseFocus({ userId })) : null;
}

export async function resumeNativeFocus(userId: string): Promise<FocusSession | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? parseFocus(await plugin.resumeFocus({ userId })) : null;
}

export async function completeNativeFocus(userId: string): Promise<FocusSession | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? parseFocus(await plugin.completeFocus({ userId })) : null;
}

export async function interruptNativeFocus(userId: string, reason: string): Promise<FocusSession | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? parseFocus(await plugin.interruptFocus({ userId, reason })) : null;
}

export async function getNativeFocusStatus(userId: string): Promise<FocusSession | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? parseFocus(await plugin.getFocusStatus({ userId })) : null;
}

export async function getNativeDigitalUsageSummary(userId: string): Promise<DigitalUsageSummary | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? parseUsageSummary(await plugin.getDailyUsageSummary({ userId })) : null;
}

/**
 * Past daily screen time, imported from the device's own usage log on first call
 * and kept locally afterwards. Returns null off-device so callers can fall back to
 * server data.
 */
export async function getNativeUsageHistory(userId: string, days = 30): Promise<DailyUsageHistory | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  if (!plugin) return null;
  const data = record(await plugin.getDailyUsageHistory({ userId, days }));
  const list = Array.isArray(data.days) ? data.days : [];
  return {
    available: bool(data.available),
    explanation: text(data.explanation),
    days: list.map(parseUsageSummary).filter((day) => Boolean(day.localDate)),
    daysImported: number(data.daysImported) ?? 0,
    oldestImportedDate: text(data.oldestImportedDate),
    truncatedOldestDropped: bool(data.truncatedOldestDropped),
  };
}

/** Per-app breakdown for one `yyyy-MM-dd` local day, largest first. */
export async function getNativeAppUsageForDay(userId: string, localDate: string): Promise<AppUsageEntry[]> {
  assertUserId(userId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error('localDate must be yyyy-MM-dd.');
  const plugin = nativePlugin();
  if (!plugin) return [];
  const apps = record(await plugin.getAppUsageForDay({ userId, localDate })).apps;
  if (!Array.isArray(apps)) return [];
  return apps.flatMap((candidate) => {
    const app = record(candidate);
    const packageName = text(app.packageName);
    const foregroundMs = number(app.foregroundMs);
    if (!packageName || foregroundMs === undefined) return [];
    return [{
      packageName,
      label: text(app.label) ?? packageName,
      category: text(app.category) ?? 'OTHER',
      foregroundMs,
    }];
  });
}

export async function saveProtectedApplications(userId: string, apps: ProtectedApplication[]): Promise<number> {
  assertUserId(userId);
  const plugin = nativePlugin();
  if (!plugin) return 0;
  const result = record(await plugin.saveProtectedApps({ userId, apps }));
  return number(result.saved) ?? 0;
}

export async function getProtectedApplications(userId: string): Promise<ProtectedApplication[]> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? parseProtectedApplications(await plugin.getProtectedApps({ userId })) : [];
}

export async function evaluateDoomscrollRule(
  userId: string,
  policy: ProtectedAppPolicy,
  signals: Partial<Record<DoomscrollSignal, number>>,
  threshold = 10
): Promise<DoomscrollEvaluation | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  if (!plugin) return null;
  const data = record(await plugin.evaluateDoomscroll({ userId, policy, signals, threshold }));
  return {
    score: number(data.score) ?? 0,
    threshold: number(data.threshold) ?? threshold,
    triggered: bool(data.triggered),
    requestedPolicy: (text(data.requestedPolicy) as ProtectedAppPolicy) ?? policy,
    effectiveAction: (text(data.effectiveAction) as DoomscrollEvaluation['effectiveAction']) ?? 'allow',
    reasons: Array.isArray(data.reasons) ? data.reasons.filter((reason): reason is string => typeof reason === 'string') : [],
  };
}

export async function joinNativeStudyRoomFocus(userId: string, session: StudyRoomFocusSession): Promise<FocusSession | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  if (!plugin) return null;
  const result = record(await plugin.joinRoomFocus({ userId, ...session }));
  return parseFocus(result.nativeFocus);
}

export async function getDigitalDisciplineSyncStatus(userId: string): Promise<DigitalDisciplineSyncStatus | null> {
  assertUserId(userId);
  const plugin = nativePlugin();
  if (!plugin) return null;
  const data = record(await plugin.getSyncStatus({ userId }));
  return {
    pending: number(data.pending) ?? 0,
    syncing: number(data.syncing) ?? 0,
    synced: number(data.synced) ?? 0,
    failed: number(data.failed) ?? 0,
    uploadsEnabled: bool(data.uploadsEnabled),
    explanation: text(data.explanation) ?? '',
  };
}

export async function clearNativeUsageData(userId: string): Promise<boolean> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? bool(record(await plugin.deleteUsageData({ userId })).deleted) : false;
}

export async function clearNativeFocusHistory(userId: string): Promise<boolean> {
  assertUserId(userId);
  const plugin = nativePlugin();
  return plugin ? bool(record(await plugin.clearFocusHistory({ userId })).deleted) : false;
}

export async function disableNativeDigitalDisciplineMonitoring(): Promise<boolean> {
  const plugin = nativePlugin();
  return plugin ? bool(record(await plugin.disableMonitoring()).disabled) : false;
}

/** Existing web focus invokes this opportunistically; web/Electron remain no-ops. */
export async function startNativeFocusForExistingTimer(userId: string, subject?: string, durationMinutes?: number): Promise<void> {
  try {
    await startNativeFocus(userId, {
      mode: 'NORMAL',
      controlLevel: 'STANDARD',
      durationMinutes: durationMinutes ?? 0,
      subject,
    });
  } catch {
    // The existing web timer must remain usable when native setup is incomplete.
  }
}

export async function completeNativeFocusForExistingTimer(userId: string): Promise<void> {
  try {
    await completeNativeFocus(userId);
  } catch {
    // Idempotent integration: local timer/session saving remains the existing source of truth.
  }
}

/**
 * Pushes current local values to the home-screen widgets. Called after events
 * that change what a widget would display, so the home screen is not left
 * showing a stale number until the next scheduled widget update.
 */
export async function refreshHomeScreenWidgets(): Promise<boolean> {
  const plugin = nativePlugin();
  if (!plugin) return false;
  try {
    await plugin.refreshWidgets();
    return true;
  } catch {
    // Widgets also refresh on their own schedule, so a failure here is not fatal.
    return false;
  }
}

/** Sets the daily focus target the weekly goal widget measures progress against. */
export async function setDailyFocusGoalMinutes(
  userId: string,
  dailyMinutes: number
): Promise<number | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  assertUserId(userId);
  const safe = Math.min(1440, Math.max(5, Math.round(dailyMinutes)));
  const result = record(await plugin.setFocusGoal({ userId, dailyMinutes: safe }));
  return number(result.dailyMinutes) ?? null;
}

export interface FocusBubbleState {
  enabled: boolean;
  /** Present when the request was refused, e.g. the overlay permission is missing. */
  explanation?: string;
}

export interface ProgressState {
  streakDays: number;
  todayFocusMinutes: number;
  dailyGoalMinutes: number;
  weekFocusMinutes: number;
  /** True only when the user's own daily goal was actually reached. */
  goalMet: boolean;
  enabled: boolean;
  milestonesHit: string[];
}

function parseProgressState(value: unknown): ProgressState {
  const data = record(value);
  return {
    streakDays: number(data.streakDays) ?? 0,
    todayFocusMinutes: number(data.todayFocusMinutes) ?? 0,
    dailyGoalMinutes: number(data.dailyGoalMinutes) ?? 0,
    weekFocusMinutes: number(data.weekFocusMinutes) ?? 0,
    goalMet: bool(data.goalMet),
    enabled: bool(data.enabled),
    milestonesHit: Array.isArray(data.milestonesHit)
      ? data.milestonesHit.flatMap((entry) => (typeof entry === 'string' ? [entry] : []))
      : [],
  };
}

/**
 * Local focus streak and goal state. Every figure comes from daily usage
 * summaries recorded on this device; nothing is compared to other users.
 */
export async function getProgressState(userId: string): Promise<ProgressState | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  try {
    return parseProgressState(await plugin.getProgressState({ userId }));
  } catch {
    return null;
  }
}

/** Opt-in encouragement notifications. Off by default, at most one per day. */
export async function setProgressNotificationsEnabled(
  userId: string,
  enabled: boolean
): Promise<boolean> {
  const plugin = nativePlugin();
  if (!plugin) return false;
  try {
    const result = record(await plugin.setProgressNotifications({ userId, enabled }));
    return bool(result.enabled);
  } catch {
    return false;
  }
}

export interface WeeklyUsageSummary {
  weekStart: string;
  screenTimeMs: number;
  studyTimeMs: number;
  focusTimeMs: number;
  doomscrollTimeMs: number;
  updatedAtMs: number;
}

/**
 * Weekly rollups, recomputed natively from the daily rows on each read. Returns
 * an empty list when the native layer is unavailable, so the reports view can
 * fall back to its server data rather than rendering a broken chart.
 */
export async function getWeeklyUsageSummaries(
  userId: string,
  weeks = 8
): Promise<WeeklyUsageSummary[]> {
  const plugin = nativePlugin();
  if (!plugin) return [];
  try {
    const data = record(await plugin.getWeeklyUsageSummaries({ userId, weeks }));
    const list = data.weeks;
    if (!Array.isArray(list)) return [];
    return list.flatMap((candidate) => {
      const week = record(candidate);
      const weekStart = text(week.weekStart);
      return weekStart
        ? [{
            weekStart,
            screenTimeMs: number(week.screenTimeMs) ?? 0,
            studyTimeMs: number(week.studyTimeMs) ?? 0,
            focusTimeMs: number(week.focusTimeMs) ?? 0,
            doomscrollTimeMs: number(week.doomscrollTimeMs) ?? 0,
            updatedAtMs: number(week.updatedAtMs) ?? 0,
          }]
        : [];
    });
  } catch {
    return [];
  }
}

export interface NativeAlarmSpec {
  id: number;
  title: string;
  body: string;
  triggerAtMs: number;
  snoozeMinutes?: number;
}

export interface NativeAlarmRecord extends NativeAlarmSpec {
  state: 'scheduled' | 'snoozed' | 'fired' | 'dismissed';
}

export interface NativeAlarmSyncResult {
  scheduled: number[];
  rejected: number[];
  /** Alarms dropped because their trigger time had already passed. */
  past: number[];
  /** Alarms cancelled because the caller no longer listed them. */
  removed: number[];
  /** False when Android will not honour an exact trigger; alarms still fire, later. */
  exactAllowed: boolean;
}

function parseAlarmSync(value: unknown): NativeAlarmSyncResult {
  const data = record(value);
  const ids = (key: string): number[] => {
    const list = data[key];
    return Array.isArray(list) ? list.flatMap((entry) => (typeof entry === 'number' ? [entry] : [])) : [];
  };
  return {
    scheduled: ids('scheduled'),
    rejected: ids('rejected'),
    past: ids('past'),
    removed: ids('removed'),
    exactAllowed: bool(data.exactAllowed),
  };
}

function parseAlarmRecords(value: unknown): NativeAlarmRecord[] {
  const list = record(value).alarms;
  if (!Array.isArray(list)) return [];
  return list.flatMap((candidate) => {
    const alarm = record(candidate);
    const id = number(alarm.id);
    const state = text(alarm.state);
    if (id === undefined) return [];
    const valid: NativeAlarmRecord['state'][] = ['scheduled', 'snoozed', 'fired', 'dismissed'];
    return [{
      id,
      title: text(alarm.title) ?? '',
      body: text(alarm.body) ?? '',
      triggerAtMs: number(alarm.triggerAtMs) ?? 0,
      snoozeMinutes: number(alarm.snoozeMinutes),
      state: state && valid.includes(state as NativeAlarmRecord['state'])
        ? (state as NativeAlarmRecord['state'])
        : 'scheduled',
    }];
  });
}

/**
 * Makes the native AlarmManager schedule match the supplied list exactly.
 *
 * Anything omitted is cancelled natively, which is what stops an alarm the user
 * deleted in the web app from still firing later.
 */
export async function syncNativeAlarms(alarms: NativeAlarmSpec[]): Promise<NativeAlarmSyncResult | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  const safe = alarms.flatMap((alarm) =>
    typeof alarm.id === 'number' && alarm.id > 0 && Number.isFinite(alarm.triggerAtMs)
      ? [{
          id: Math.trunc(alarm.id),
          title: (alarm.title ?? '').slice(0, 120),
          body: (alarm.body ?? '').slice(0, 400),
          triggerAtMs: alarm.triggerAtMs,
          snoozeMinutes: alarm.snoozeMinutes ?? 9,
        }]
      : []
  );
  return parseAlarmSync(await plugin.syncNativeAlarms({ alarms: safe }));
}

export async function cancelNativeAlarm(id: number): Promise<boolean> {
  const plugin = nativePlugin();
  if (!plugin) return false;
  try {
    await plugin.cancelNativeAlarm({ id });
    return true;
  } catch {
    return false;
  }
}

export async function listNativeAlarms(): Promise<NativeAlarmRecord[]> {
  const plugin = nativePlugin();
  if (!plugin) return [];
  return parseAlarmRecords(await plugin.listNativeAlarms());
}

/**
 * Turns the draggable focus bubble on or off. The bubble only starts and stops a
 * focus session; it never blocks or force-stops an app.
 */
export async function setFocusBubbleEnabled(enabled: boolean): Promise<FocusBubbleState> {
  const plugin = nativePlugin();
  if (!plugin) return { enabled: false };
  try {
    const result = record(await plugin.setFocusBubble({ enabled }));
    return { enabled: bool(result.enabled), explanation: text(result.explanation) };
  } catch {
    return { enabled: false };
  }
}
