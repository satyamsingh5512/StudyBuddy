'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Hourglass, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MAX_APP_RULES,
  MAX_DAILY_LIMIT_MINUTES,
  MAX_RULE_WINDOWS,
  setAppRules,
  type AppRule,
  type AppUsageEntry,
  type LaunchableApp,
} from '@/lib/studyToolkit';
import {
  DayChips,
  SECTION_MIN_BODY,
  ToolSection,
  formatDuration,
  minutesToTime,
  timeToMinutes,
  type SectionProps,
} from './shared';

interface AppLimitsSectionProps extends SectionProps {
  appRules: AppRule[];
  usageToday: AppUsageEntry[];
  installedApps: LaunchableApp[];
  nativeAvailable: boolean;
  onAppRules: (next: AppRule[] | null) => void;
  open: boolean;
  onToggle: (id: string) => void;
}

export const AppLimitsSection = memo(function AppLimitsSection({
  appRules,
  usageToday,
  installedApps,
  nativeAvailable,
  disabled,
  onRun,
  onAppRules,
  open,
  onToggle,
}: AppLimitsSectionProps) {
  const [draft, setDraft] = useState<AppRule[]>(appRules);
  const [pickerPackage, setPickerPackage] = useState('');

  useEffect(() => {
    setDraft(appRules);
  }, [appRules]);

  const labelFor = useCallback(
    (packageName: string) =>
      installedApps.find((app) => app.packageName === packageName)?.label ?? packageName,
    [installedApps]
  );

  const addable = useMemo(
    () => installedApps.filter((app) => !draft.some((rule) => rule.packageName === app.packageName)),
    [installedApps, draft]
  );

  const usageByPackage = useMemo(() => {
    const map = new Map<string, number>();
    usageToday.forEach((entry) => map.set(entry.packageName, entry.seconds));
    return map;
  }, [usageToday]);

  const updateRule = useCallback((packageName: string, patch: Partial<AppRule>) => {
    setDraft((rules) =>
      rules.map((rule) => (rule.packageName === packageName ? { ...rule, ...patch } : rule))
    );
  }, []);

  const addRule = useCallback(() => {
    if (!pickerPackage) return;
    setDraft((rules) =>
      rules.length >= MAX_APP_RULES || rules.some((rule) => rule.packageName === pickerPackage)
        ? rules
        : [...rules, { packageName: pickerPackage, dailyLimitMinutes: 60, windows: [] }]
    );
    setPickerPackage('');
  }, [pickerPackage]);

  return (
    <ToolSection
      id="app-limits"
      title="App limits and schedules"
      icon={<Hourglass className="h-5 w-5" />}
      minBodyHeight={SECTION_MIN_BODY.appLimits}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-sm text-muted-foreground">
        Give an app a daily budget, or hours it is closed regardless of how much you have used it.
        Reaching a limit sends you to the home screen — nothing is uninstalled or hidden, and you
        can always change the rule here.
      </p>
      {!nativeAvailable ? (
        <p className="text-xs text-muted-foreground">Available in the Android app.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1 space-y-1">
            <Label htmlFor="app-limit-picker" className="text-xs">
              Add an app
            </Label>
            <Select value={pickerPackage} onValueChange={setPickerPackage} disabled={disabled}>
              <SelectTrigger id="app-limit-picker" aria-label="Choose an app to limit">
                <SelectValue placeholder="Choose an app" />
              </SelectTrigger>
              <SelectContent>
                {addable.map((app) => (
                  <SelectItem key={app.packageName} value={app.packageName}>
                    {app.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={disabled || !pickerPackage || draft.length >= MAX_APP_RULES}
            onClick={addRule}
          >
            <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Add rule
          </Button>
        </div>
      )}

      {draft.length === 0 && <p className="text-sm text-muted-foreground">No app rules yet.</p>}

      <div className="space-y-3">
        {draft.map((rule) => {
          const usedSeconds = usageByPackage.get(rule.packageName) ?? 0;
          const budgetSeconds = rule.dailyLimitMinutes * 60;
          const percent =
            budgetSeconds > 0 ? Math.min(100, Math.round((usedSeconds / budgetSeconds) * 100)) : 0;
          return (
            <div key={rule.packageName} className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{labelFor(rule.packageName)}</p>
                  <p className="break-all text-xs text-muted-foreground">{rule.packageName}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`app-limit-${rule.packageName}`} className="text-xs">
                    Minutes a day (0 = none)
                  </Label>
                  <Input
                    id={`app-limit-${rule.packageName}`}
                    type="number"
                    min={0}
                    max={MAX_DAILY_LIMIT_MINUTES}
                    inputMode="numeric"
                    className="w-24"
                    value={String(rule.dailyLimitMinutes)}
                    disabled={disabled}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      updateRule(rule.packageName, {
                        dailyLimitMinutes: Number.isFinite(next)
                          ? Math.min(MAX_DAILY_LIMIT_MINUTES, Math.max(0, Math.round(next)))
                          : 0,
                      });
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10 min-w-10"
                  aria-label={`Remove the rule for ${labelFor(rule.packageName)}`}
                  disabled={disabled}
                  onClick={() =>
                    setDraft((rules) => rules.filter((r) => r.packageName !== rule.packageName))
                  }
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>

              {/* Today's measured use against the budget. */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span>Today: {formatDuration(usedSeconds)}</span>
                  {rule.dailyLimitMinutes > 0 && <span>of {rule.dailyLimitMinutes}m</span>}
                </div>
                {rule.dailyLimitMinutes > 0 && (
                  <div
                    role="progressbar"
                    aria-label={`Today's use of ${labelFor(rule.packageName)}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className={`h-full rounded-full ${percent >= 100 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {rule.windows.map((window, index) => (
                  <div
                    key={`${rule.packageName}-window-${index}`}
                    className="space-y-2 rounded-lg border border-border/40 p-2"
                  >
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`app-window-start-${rule.packageName}-${index}`} className="text-xs">
                          From
                        </Label>
                        <Input
                          id={`app-window-start-${rule.packageName}-${index}`}
                          type="time"
                          className="w-28"
                          value={minutesToTime(window.startMinute)}
                          disabled={disabled}
                          onChange={(event) => {
                            const minutes = timeToMinutes(event.target.value);
                            if (minutes === null) return;
                            updateRule(rule.packageName, {
                              windows: rule.windows.map((w, i) =>
                                i === index ? { ...w, startMinute: minutes } : w
                              ),
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`app-window-end-${rule.packageName}-${index}`} className="text-xs">
                          To
                        </Label>
                        <Input
                          id={`app-window-end-${rule.packageName}-${index}`}
                          type="time"
                          className="w-28"
                          value={minutesToTime(window.endMinute)}
                          disabled={disabled}
                          onChange={(event) => {
                            const minutes = timeToMinutes(event.target.value);
                            if (minutes === null) return;
                            updateRule(rule.packageName, {
                              windows: rule.windows.map((w, i) =>
                                i === index ? { ...w, endMinute: minutes } : w
                              ),
                            });
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-10 min-w-10"
                        aria-label={`Remove schedule ${index + 1} for ${labelFor(rule.packageName)}`}
                        disabled={disabled}
                        onClick={() =>
                          updateRule(rule.packageName, {
                            windows: rule.windows.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </div>
                    {window.endMinute <= window.startMinute && (
                      <p className="text-xs text-muted-foreground">
                        This schedule runs past midnight and ends the next morning.
                      </p>
                    )}
                    <DayChips
                      legend="Days"
                      namePrefix={`app-window-${rule.packageName}-${index}`}
                      selected={window.days}
                      disabled={disabled}
                      onToggle={(day) =>
                        updateRule(rule.packageName, {
                          windows: rule.windows.map((w, i) =>
                            i === index
                              ? {
                                  ...w,
                                  days: w.days.includes(day)
                                    ? w.days.filter((d) => d !== day)
                                    : [...w.days, day].sort((a, b) => a - b),
                                }
                              : w
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  disabled={disabled || rule.windows.length >= MAX_RULE_WINDOWS}
                  onClick={() =>
                    updateRule(rule.packageName, {
                      windows: [
                        ...rule.windows,
                        { days: [2, 3, 4, 5, 6], startMinute: 9 * 60, endMinute: 17 * 60 },
                      ],
                    })
                  }
                >
                  <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
                  Add schedule
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {draft.length > 0 && (
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={disabled}
          onClick={() =>
            onRun(
              'app-rules-save',
              async () => onAppRules(await setAppRules(draft)),
              'App rules saved'
            )
          }
        >
          Save app rules
        </Button>
      )}
    </ToolSection>
  );
});
