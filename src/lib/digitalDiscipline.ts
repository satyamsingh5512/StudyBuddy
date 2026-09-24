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
