import { registerPlugin } from '@capacitor/core';
import { getPlatform, isNativeApp } from '@/lib/capacitor';

/**
 * Stable web-to-native contract for the StudyBuddy study toolkit: focus sounds,
 * scheduled Zen windows, leave-focus nudges and study reminders, short-form feed
 * blocking, the distraction-free home screen, and guided permission setup.
 *
 * Two rules hold throughout, matching src/lib/digitalDiscipline.ts:
 *
 * 1. Nothing here throws on the web. Every reader returns a documented safe default
 *    so a page can render its controls before it knows whether the native plugin is
 *    present. Writers are no-ops that resolve to `null`/`false`.
 * 2. Every response is re-validated rather than trusted. The plugin is the boundary
 *    between the WebView and the device, and a partially-populated payload from an
 *    older APK must degrade to defaults rather than produce `undefined` in the UI.
 */

export type ToolkitPermissionKey =
  | 'notifications'
  | 'exactAlarms'
  | 'usageAccess'
  | 'overlay'
  | 'accessibility'
  | 'dndPolicy'
  | 'batteryOptimization'
  | 'defaultHome';

export const TOOLKIT_PERMISSION_KEYS: ToolkitPermissionKey[] = [
  'notifications',
  'exactAlarms',
  'dndPolicy',
  'accessibility',
  'usageAccess',
  'overlay',
  'batteryOptimization',
  'defaultHome',
];

export interface ToolkitPermissionState {
  granted: boolean;
  required: boolean;
}

export type ToolkitPermissions = Record<ToolkitPermissionKey, ToolkitPermissionState>;

export interface Soundscape {
  id: string;
  label: string;
}

export interface FocusSoundStatus {
  playing: boolean;
  paused: boolean;
  soundscapeId?: string;
  volume: number;
  followFocus: boolean;
  endsAtMs?: number;
}

/**
 * A recurring do-not-disturb study window.
 *
 * `daysOfWeek` uses the Android/JS-compatible 1..7 numbering (1 = Sunday) so the
 * value crossing the bridge never needs remapping. `startMinute`/`endMinute` are
 * minutes from local midnight; an end at or before the start crosses midnight and
 * belongs to its start day.
 */
export interface ZenWindow {
  id: string;
  label: string;
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  enabled: boolean;
  startFocus: boolean;
  allowPriorityOnly: boolean;
}

export interface ZenConfig {
  enabled: boolean;
  active: boolean;
  hasPolicyAccess: boolean;
  activeWindowId?: string;
  nextChangeAtMs?: number;
  windows: ZenWindow[];
}

export interface NudgeConfig {
  leaveFocusEnabled: boolean;
  studyPackages: string[];
  remindersEnabled: boolean;
  /** Minutes from local midnight, ascending. */
  reminderTimes: number[];
  /** 1 = Sunday through 7 = Saturday. */
  reminderDays: number[];
  idleNudgeEnabled: boolean;
}

export interface ShortsBlockConfig {
  serviceEnabled: boolean;
  youtubeEnabled: boolean;
  instagramEnabled: boolean;
  facebookEnabled: boolean;
  snapchatEnabled: boolean;
  onlyDuringFocus: boolean;
  dailyAllowanceMinutes: number;
  blockedPackages: string[];
  protectSettings: boolean;
  /** Videos allowed per day in a detected feed. 0 means no swipe limit. */
  swipeLimit: number;
  blockInBrowsers: boolean;
  blockTikTok: boolean;
  blockedToday: number;
  shortsSecondsToday: number;
  reelsSwiped: number;
  browserBlocks: number;
  strictMode: boolean;
  /** Strict protection applies all the time, not only during a focus session. */
  strictAlways: boolean;
  strictCooloffMinutes: number;
  /** Whether strict protection is in force right now. */
  strictActive: boolean;
  /**
   * When a requested strict-mode disable takes effect. Absent when nothing is
   * pending — the cool-off is the only way out, so the countdown is the whole story.
   */
  strictPendingUntilMs?: number;
}

/**
 * One schedule during which an app is blocked.
 *
 * `days` uses the same 1..7 numbering as Zen windows (1 = Sunday). An `endMinute`
 * at or before `startMinute` crosses midnight and belongs to its start day.
 */
export interface AppRuleWindow {
  days: number[];
  startMinute: number;
  endMinute: number;
}

/** A per-app daily limit plus any blocked schedules. */
export interface AppRule {
  packageName: string;
  /** Minutes of foreground use allowed today. 0 means no daily limit. */
  dailyLimitMinutes: number;
  windows: AppRuleWindow[];
}

/** Today's measured foreground time for one app. */
export interface AppUsageEntry {
  packageName: string;
  seconds: number;
}

/** The two always-visible surfaces: the floating chip and the standing notification. */
export interface ActiveBlocksConfig {
  chipEnabled: boolean;
  chipRunning: boolean;
  standingEnabled: boolean;
  overlayPermission: boolean;
}

export interface LauncherConfig {
  enabled: boolean;
  isDefaultHome: boolean;
  allowedApps: string[];
}

export interface LaunchableApp {
  packageName: string;
  label: string;
}

export interface ToolkitStatus {
  available: boolean;
  sounds: FocusSoundStatus;
  zen: ZenConfig;
  nudges: NudgeConfig;
  shortsBlock: ShortsBlockConfig;
  appRules: AppRule[];
  activeBlocks: ActiveBlocksConfig;
  launcher: LauncherConfig;
  permissions: ToolkitPermissions;
  interruptionFilter: 'ALL' | 'PRIORITY' | 'NONE' | 'ALARMS' | 'UNKNOWN';
}

export interface ShortsBlockUpdate {
  youtubeEnabled?: boolean;
  instagramEnabled?: boolean;
  facebookEnabled?: boolean;
  snapchatEnabled?: boolean;
  onlyDuringFocus?: boolean;
  dailyAllowanceMinutes?: number;
  blockedPackages?: string[];
  protectSettings?: boolean;
  swipeLimit?: number;
  blockInBrowsers?: boolean;
  blockTikTok?: boolean;
  /**
   * Passing `strictMode: false` does not switch strict mode off directly. The device
   * records the request and keeps protection in force until the cool-off expires, so
   * treat it the same as calling {@link requestStrictDisable}.
   */
  strictMode?: boolean;
  strictAlways?: boolean;
  strictCooloffMinutes?: number;
}

interface NativeStudyToolkitPlugin {
  getToolkitStatus(): Promise<unknown>;
  listSoundscapes(): Promise<unknown>;
  startFocusSound(options: {
    soundscapeId: string;
    volume: number;
    stopAfterMinutes?: number;
    followFocus: boolean;
  }): Promise<unknown>;
  pauseFocusSound(): Promise<unknown>;
  resumeFocusSound(): Promise<unknown>;
  stopFocusSound(): Promise<unknown>;
  setFocusSoundVolume(options: { volume: number }): Promise<unknown>;
  getZenConfig(): Promise<unknown>;
  setZenWindows(options: { windows: ZenWindow[] }): Promise<unknown>;
  setZenEnabled(options: { enabled: boolean }): Promise<unknown>;
  zenEnterNow(options: { minutes: number }): Promise<unknown>;
  zenExitNow(): Promise<unknown>;
  getNudgeConfig(): Promise<unknown>;
  setNudgeConfig(options: {
    leaveFocusEnabled: boolean;
    studyPackages: string[];
    reminderTimes: number[];
    reminderDays: number[];
    remindersEnabled: boolean;
  }): Promise<unknown>;
  getShortsBlockConfig(): Promise<unknown>;
  setShortsBlockConfig(options: ShortsBlockUpdate): Promise<unknown>;
  requestStrictDisable(): Promise<unknown>;
  getAppRules(): Promise<unknown>;
  setAppRules(options: { rules: AppRule[] }): Promise<unknown>;
  getAppUsageToday(): Promise<unknown>;
  getActiveBlocksConfig(): Promise<unknown>;
  setActiveBlocksChip(options: { enabled: boolean }): Promise<unknown>;
  setStandingNotification(options: { enabled: boolean }): Promise<unknown>;
  getLauncherConfig(): Promise<unknown>;
  setLauncherEnabled(options: { enabled: boolean }): Promise<unknown>;
  setLauncherAllowedApps(options: { packages: string[] }): Promise<unknown>;
  listLaunchableApps(): Promise<unknown>;
  getPermissionStatus(): Promise<unknown>;
  openPermission(options: { key: ToolkitPermissionKey }): Promise<unknown>;
}

const NativeStudyToolkit = registerPlugin<NativeStudyToolkitPlugin>('StudyToolkit');

const nativePlugin = (): NativeStudyToolkitPlugin | null =>
  isNativeApp() && getPlatform() === 'android' ? NativeStudyToolkit : null;

/** Mirrors of the bounds the plugin enforces, so a bad value never reaches the bridge. */
export const MAX_SWIPE_LIMIT = 200;
export const MAX_STRICT_COOLOFF_MINUTES = 120;
export const MAX_APP_RULES = 50;
export const MAX_RULE_WINDOWS = 6;
export const MAX_DAILY_LIMIT_MINUTES = 1440;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const bool = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;
const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const numberOr = (value: unknown, fallback: number): number => number(value) ?? fallback;
const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const strings = (value: unknown): string[] =>
  list(value)
    .map((entry) => text(entry))
    .filter((entry): entry is string => Boolean(entry));
const integersInRange = (value: unknown, min: number, max: number): number[] =>
  list(value)
    .map((entry) => number(entry))
    .filter((entry): entry is number => entry !== undefined && entry >= min && entry <= max)
    .map((entry) => Math.round(entry));

/** Whether the native toolkit plugin is reachable at all. */
export function isStudyToolkitAvailable(): boolean {
  return nativePlugin() !== null;
}

// ------------------------------------------------------------------- parsing

function parsePermissions(value: unknown): ToolkitPermissions {
  const data = record(value);
  const result = {} as ToolkitPermissions;
  for (const key of TOOLKIT_PERMISSION_KEYS) {
    const entry = record(data[key]);
    result[key] = { granted: bool(entry.granted), required: bool(entry.required) };
  }
  return result;
}

function emptyPermissions(): ToolkitPermissions {
  const result = {} as ToolkitPermissions;
  for (const key of TOOLKIT_PERMISSION_KEYS) {
    result[key] = { granted: false, required: false };
  }
  return result;
}

function parseSoundStatus(value: unknown): FocusSoundStatus {
  const data = record(value);
  return {
    playing: bool(data.playing),
    paused: bool(data.paused),
    soundscapeId: text(data.soundscapeId),
    // Clamped rather than trusted: the slider is bound directly to this value.
    volume: Math.min(1, Math.max(0, numberOr(data.volume, 0.7))),
    followFocus: bool(data.followFocus),
    endsAtMs: number(data.endsAtMs),
  };
}

function parseZenWindow(value: unknown, index: number): ZenWindow {
  const data = record(value);
  return {
    id: text(data.id) ?? `window-${index}`,
    label: text(data.label) ?? 'Study window',
    daysOfWeek: integersInRange(data.daysOfWeek, 1, 7),
    startMinute: Math.min(1439, Math.max(0, numberOr(data.startMinute, 0))),
    endMinute: Math.min(1439, Math.max(0, numberOr(data.endMinute, 0))),
    enabled: bool(data.enabled, true),
    startFocus: bool(data.startFocus),
    allowPriorityOnly: bool(data.allowPriorityOnly, true),
  };
}

function parseZenConfig(value: unknown): ZenConfig {
  const data = record(value);
  return {
    enabled: bool(data.enabled),
    active: bool(data.active),
    hasPolicyAccess: bool(data.hasPolicyAccess),
    activeWindowId: text(data.activeWindowId),
    nextChangeAtMs: number(data.nextChangeAtMs),
    windows: list(data.windows).map((entry, index) => parseZenWindow(entry, index)),
  };
}

function emptyZenConfig(): ZenConfig {
  return { enabled: false, active: false, hasPolicyAccess: false, windows: [] };
}

function parseNudgeConfig(value: unknown): NudgeConfig {
  const data = record(value);
  return {
    leaveFocusEnabled: bool(data.leaveFocusEnabled, true),
    studyPackages: strings(data.studyPackages),
    remindersEnabled: bool(data.remindersEnabled),
    reminderTimes: integersInRange(data.reminderTimes, 0, 1439).sort((a, b) => a - b),
    reminderDays: integersInRange(data.reminderDays, 1, 7).sort((a, b) => a - b),
    idleNudgeEnabled: bool(data.idleNudgeEnabled, true),
  };
}

function emptyNudgeConfig(): NudgeConfig {
  return {
    leaveFocusEnabled: true,
    studyPackages: [],
    remindersEnabled: false,
    reminderTimes: [],
    reminderDays: [],
    idleNudgeEnabled: true,
  };
}

const counter = (value: unknown): number => Math.max(0, Math.round(numberOr(value, 0)));

function parseShortsBlockConfig(value: unknown): ShortsBlockConfig {
  const data = record(value);
  return {
    serviceEnabled: bool(data.serviceEnabled),
    youtubeEnabled: bool(data.youtubeEnabled, true),
    instagramEnabled: bool(data.instagramEnabled, true),
    facebookEnabled: bool(data.facebookEnabled),
    snapchatEnabled: bool(data.snapchatEnabled),
    onlyDuringFocus: bool(data.onlyDuringFocus),
    dailyAllowanceMinutes: Math.max(0, Math.round(numberOr(data.dailyAllowanceMinutes, 0))),
    blockedPackages: strings(data.blockedPackages),
    protectSettings: bool(data.protectSettings),
    swipeLimit: Math.min(MAX_SWIPE_LIMIT, counter(data.swipeLimit)),
    blockInBrowsers: bool(data.blockInBrowsers, true),
    blockTikTok: bool(data.blockTikTok),
    blockedToday: counter(data.blockedToday),
    shortsSecondsToday: counter(data.shortsSecondsToday),
    reelsSwiped: counter(data.reelsSwiped),
    browserBlocks: counter(data.browserBlocks),
    strictMode: bool(data.strictMode),
    strictAlways: bool(data.strictAlways),
    strictCooloffMinutes: Math.min(
      MAX_STRICT_COOLOFF_MINUTES,
      Math.max(0, Math.round(numberOr(data.strictCooloffMinutes, 10)))
    ),
    strictActive: bool(data.strictActive),
    strictPendingUntilMs: number(data.strictPendingUntilMs),
  };
}

function emptyShortsBlockConfig(): ShortsBlockConfig {
  return {
    serviceEnabled: false,
    youtubeEnabled: true,
    instagramEnabled: true,
    facebookEnabled: false,
    snapchatEnabled: false,
    onlyDuringFocus: false,
    dailyAllowanceMinutes: 0,
    blockedPackages: [],
    protectSettings: false,
    swipeLimit: 0,
    blockInBrowsers: true,
    blockTikTok: false,
    blockedToday: 0,
    shortsSecondsToday: 0,
    reelsSwiped: 0,
    browserBlocks: 0,
    strictMode: false,
    strictAlways: false,
    strictCooloffMinutes: 10,
    strictActive: false,
  };
}

function parseAppRuleWindow(value: unknown): AppRuleWindow {
  const data = record(value);
  return {
    days: integersInRange(data.days, 1, 7).sort((a, b) => a - b),
    startMinute: Math.min(1439, Math.max(0, numberOr(data.startMinute, 0))),
    endMinute: Math.min(1439, Math.max(0, numberOr(data.endMinute, 0))),
  };
}

function parseAppRule(value: unknown): AppRule | null {
  const data = record(value);
  const packageName = text(data.packageName);
  if (!packageName) return null;
  return {
    packageName,
    dailyLimitMinutes: Math.min(
      MAX_DAILY_LIMIT_MINUTES,
      Math.max(0, Math.round(numberOr(data.dailyLimitMinutes, 0)))
    ),
    windows: list(data.windows).slice(0, MAX_RULE_WINDOWS).map(parseAppRuleWindow),
  };
}

function parseAppRules(value: unknown): AppRule[] {
  return list(record(value).rules ?? value)
    .map((entry) => parseAppRule(entry))
    .filter((entry): entry is AppRule => entry !== null)
    .slice(0, MAX_APP_RULES);
}

function parseActiveBlocksConfig(value: unknown): ActiveBlocksConfig {
  const data = record(value);
  return {
    chipEnabled: bool(data.chipEnabled),
    chipRunning: bool(data.chipRunning),
    standingEnabled: bool(data.standingEnabled),
    overlayPermission: bool(data.overlayPermission),
  };
}

function emptyActiveBlocksConfig(): ActiveBlocksConfig {
  return { chipEnabled: false, chipRunning: false, standingEnabled: false, overlayPermission: false };
}

function parseLauncherConfig(value: unknown): LauncherConfig {
  const data = record(value);
  return {
    enabled: bool(data.enabled),
    isDefaultHome: bool(data.isDefaultHome),
    allowedApps: strings(data.allowedApps),
  };
}

function emptyLauncherConfig(): LauncherConfig {
  return { enabled: false, isDefaultHome: false, allowedApps: [] };
}

function parseInterruptionFilter(value: unknown): ToolkitStatus['interruptionFilter'] {
  const raw = text(value);
  const valid: ToolkitStatus['interruptionFilter'][] = ['ALL', 'PRIORITY', 'NONE', 'ALARMS', 'UNKNOWN'];
  return valid.find((entry) => entry === raw) ?? 'UNKNOWN';
}

/** The state a web browser sees: every control renders, nothing is enabled. */
export function emptyToolkitStatus(): ToolkitStatus {
  return {
    available: false,
    sounds: parseSoundStatus(undefined),
    zen: emptyZenConfig(),
    nudges: emptyNudgeConfig(),
    shortsBlock: emptyShortsBlockConfig(),
    appRules: [],
    activeBlocks: emptyActiveBlocksConfig(),
    launcher: emptyLauncherConfig(),
    permissions: emptyPermissions(),
    interruptionFilter: 'UNKNOWN',
  };
}

// ------------------------------------------------------------------- readers

export async function getToolkitStatus(): Promise<ToolkitStatus> {
  const plugin = nativePlugin();
  if (!plugin) return emptyToolkitStatus();
  const data = record(await plugin.getToolkitStatus());
  return {
    available: true,
    sounds: parseSoundStatus(data.sounds),
    zen: parseZenConfig(data.zen),
    nudges: parseNudgeConfig(data.nudges),
    shortsBlock: parseShortsBlockConfig(data.shortsBlock),
    appRules: parseAppRules(data.appRules),
    activeBlocks: parseActiveBlocksConfig(data.activeBlocks),
    launcher: parseLauncherConfig(data.launcher),
    permissions: parsePermissions(data.permissions),
    interruptionFilter: parseInterruptionFilter(data.interruptionFilter),
  };
}

export async function listSoundscapes(): Promise<Soundscape[]> {
  const plugin = nativePlugin();
  if (!plugin) return [];
  const data = record(await plugin.listSoundscapes());
  return list(data.soundscapes)
    .map((entry) => {
      const item = record(entry);
      const id = text(item.id);
      return id ? { id, label: text(item.label) ?? id } : null;
    })
    .filter((entry): entry is Soundscape => entry !== null);
}

export async function getPermissionStatus(): Promise<ToolkitPermissions> {
  const plugin = nativePlugin();
  if (!plugin) return emptyPermissions();
  return parsePermissions(await plugin.getPermissionStatus());
}

export async function getZenConfig(): Promise<ZenConfig> {
  const plugin = nativePlugin();
  if (!plugin) return emptyZenConfig();
  return parseZenConfig(await plugin.getZenConfig());
}

export async function getNudgeConfig(): Promise<NudgeConfig> {
  const plugin = nativePlugin();
  if (!plugin) return emptyNudgeConfig();
  return parseNudgeConfig(await plugin.getNudgeConfig());
}

export async function getShortsBlockConfig(): Promise<ShortsBlockConfig> {
  const plugin = nativePlugin();
  if (!plugin) return emptyShortsBlockConfig();
  return parseShortsBlockConfig(await plugin.getShortsBlockConfig());
}

export async function getAppRules(): Promise<AppRule[]> {
  const plugin = nativePlugin();
  if (!plugin) return [];
  return parseAppRules(await plugin.getAppRules());
}

/** Today's measured foreground time per app, longest first. Empty on the web. */
export async function getAppUsageToday(): Promise<AppUsageEntry[]> {
  const plugin = nativePlugin();
  if (!plugin) return [];
  const data = record(await plugin.getAppUsageToday());
  return list(data.usage)
    .map((entry) => {
      const item = record(entry);
      const packageName = text(item.packageName);
      return packageName ? { packageName, seconds: counter(item.seconds) } : null;
    })
    .filter((entry): entry is AppUsageEntry => entry !== null)
    .sort((a, b) => b.seconds - a.seconds);
}

export async function getActiveBlocksConfig(): Promise<ActiveBlocksConfig> {
  const plugin = nativePlugin();
  if (!plugin) return emptyActiveBlocksConfig();
  return parseActiveBlocksConfig(await plugin.getActiveBlocksConfig());
}

export async function getLauncherConfig(): Promise<LauncherConfig> {
  const plugin = nativePlugin();
  if (!plugin) return emptyLauncherConfig();
  return parseLauncherConfig(await plugin.getLauncherConfig());
}

export async function listLaunchableApps(): Promise<LaunchableApp[]> {
  const plugin = nativePlugin();
  if (!plugin) return [];
  const data = record(await plugin.listLaunchableApps());
  return list(data.apps)
    .map((entry) => {
      const item = record(entry);
      const packageName = text(item.packageName);
      return packageName ? { packageName, label: text(item.label) ?? packageName } : null;
    })
    .filter((entry): entry is LaunchableApp => entry !== null);
}

// ------------------------------------------------------------------- writers

const clampVolume = (volume: number): number =>
  Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.7;

/** Mirrors the native bound so an out-of-range value is rejected before the bridge. */
const clampMinutes = (minutes: number): number =>
  Math.min(600, Math.max(1, Math.round(Number.isFinite(minutes) ? minutes : 1)));

export async function startFocusSound(options: {
  soundscapeId: string;
  volume?: number;
  stopAfterMinutes?: number;
  followFocus?: boolean;
}): Promise<FocusSoundStatus | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  return parseSoundStatus(
    await plugin.startFocusSound({
      soundscapeId: options.soundscapeId,
      volume: clampVolume(options.volume ?? 0.7),
      stopAfterMinutes:
        options.stopAfterMinutes && options.stopAfterMinutes > 0
          ? clampMinutes(options.stopAfterMinutes)
          : undefined,
      followFocus: options.followFocus ?? false,
    })
  );
}

export async function pauseFocusSound(): Promise<FocusSoundStatus | null> {
  const plugin = nativePlugin();
  return plugin ? parseSoundStatus(await plugin.pauseFocusSound()) : null;
}

export async function resumeFocusSound(): Promise<FocusSoundStatus | null> {
  const plugin = nativePlugin();
  return plugin ? parseSoundStatus(await plugin.resumeFocusSound()) : null;
}

export async function stopFocusSound(): Promise<FocusSoundStatus | null> {
  const plugin = nativePlugin();
  return plugin ? parseSoundStatus(await plugin.stopFocusSound()) : null;
}

export async function setFocusSoundVolume(volume: number): Promise<FocusSoundStatus | null> {
  const plugin = nativePlugin();
  return plugin ? parseSoundStatus(await plugin.setFocusSoundVolume({ volume: clampVolume(volume) })) : null;
}

export async function setZenWindows(windows: ZenWindow[]): Promise<ZenConfig | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  return parseZenConfig(await plugin.setZenWindows({ windows }));
}

export async function setZenEnabled(enabled: boolean): Promise<ZenConfig | null> {
  const plugin = nativePlugin();
  return plugin ? parseZenConfig(await plugin.setZenEnabled({ enabled })) : null;
}

export async function zenEnterNow(minutes: number): Promise<ZenConfig | null> {
  const plugin = nativePlugin();
  return plugin ? parseZenConfig(await plugin.zenEnterNow({ minutes: clampMinutes(minutes) })) : null;
}

export async function zenExitNow(): Promise<ZenConfig | null> {
  const plugin = nativePlugin();
  return plugin ? parseZenConfig(await plugin.zenExitNow()) : null;
}

export async function setNudgeConfig(options: {
  leaveFocusEnabled: boolean;
  studyPackages: string[];
  reminderTimes: number[];
  reminderDays: number[];
  remindersEnabled: boolean;
}): Promise<NudgeConfig | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  return parseNudgeConfig(
    await plugin.setNudgeConfig({
      leaveFocusEnabled: options.leaveFocusEnabled,
      studyPackages: options.studyPackages.slice(0, 50),
      reminderTimes: options.reminderTimes.slice(0, 12),
      reminderDays: options.reminderDays,
      remindersEnabled: options.remindersEnabled,
    })
  );
}

export async function setShortsBlockConfig(update: ShortsBlockUpdate): Promise<ShortsBlockConfig | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  return parseShortsBlockConfig(
    await plugin.setShortsBlockConfig({
      ...update,
      dailyAllowanceMinutes:
        update.dailyAllowanceMinutes === undefined
          ? undefined
          : Math.min(600, Math.max(0, Math.round(update.dailyAllowanceMinutes))),
      blockedPackages: update.blockedPackages?.slice(0, 50),
      swipeLimit:
        update.swipeLimit === undefined
          ? undefined
          : Math.min(MAX_SWIPE_LIMIT, Math.max(0, Math.round(update.swipeLimit))),
      strictCooloffMinutes:
        update.strictCooloffMinutes === undefined
          ? undefined
          : Math.min(MAX_STRICT_COOLOFF_MINUTES, Math.max(0, Math.round(update.strictCooloffMinutes))),
    })
  );
}

/**
 * Starts the cool-off after which strict mode switches off.
 *
 * There is deliberately no immediate off switch: the point of strict mode is to be
 * harder to undo than the impulse that wants it gone. The returned config carries
 * `strictPendingUntilMs` so the UI can show exactly how long is left, and strict mode
 * always does become disable-able once that passes.
 */
export async function requestStrictDisable(): Promise<ShortsBlockConfig | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  return parseShortsBlockConfig(await plugin.requestStrictDisable());
}

export async function setAppRules(rules: AppRule[]): Promise<AppRule[] | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  // Trimmed to the same bounds the plugin enforces, so an over-long list is caught
  // here rather than rejecting the whole write on the device.
  const trimmed = rules.slice(0, MAX_APP_RULES).map((rule) => ({
    packageName: rule.packageName,
    dailyLimitMinutes: Math.min(MAX_DAILY_LIMIT_MINUTES, Math.max(0, Math.round(rule.dailyLimitMinutes))),
    windows: rule.windows.slice(0, MAX_RULE_WINDOWS).map((window) => ({
      days: window.days.filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b),
      startMinute: Math.min(1439, Math.max(0, Math.round(window.startMinute))),
      endMinute: Math.min(1439, Math.max(0, Math.round(window.endMinute))),
    })),
  }));
  return parseAppRules(await plugin.setAppRules({ rules: trimmed }));
}

export async function setActiveBlocksChip(enabled: boolean): Promise<ActiveBlocksConfig | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  return parseActiveBlocksConfig(await plugin.setActiveBlocksChip({ enabled }));
}

export async function setStandingNotification(enabled: boolean): Promise<ActiveBlocksConfig | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  return parseActiveBlocksConfig(await plugin.setStandingNotification({ enabled }));
}

export async function setLauncherEnabled(enabled: boolean): Promise<LauncherConfig | null> {
  const plugin = nativePlugin();
  return plugin ? parseLauncherConfig(await plugin.setLauncherEnabled({ enabled })) : null;
}

export async function setLauncherAllowedApps(packages: string[]): Promise<LauncherConfig | null> {
  const plugin = nativePlugin();
  if (!plugin) return null;
  return parseLauncherConfig(await plugin.setLauncherAllowedApps({ packages: packages.slice(0, 50) }));
}

/**
 * Opens the system settings screen for one permission and shows the on-device
 * guidance for it. Resolves false on the web or when no screen could be launched.
 */
export async function openToolkitPermission(key: ToolkitPermissionKey): Promise<boolean> {
  const plugin = nativePlugin();
  if (!plugin) return false;
  const data = record(await plugin.openPermission({ key }));
  return bool(data.opened);
}
