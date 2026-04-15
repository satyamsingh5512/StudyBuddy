import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';

interface Report {
  id: string;
  date: string;
  tasksPlanned: number;
  tasksCompleted: number;
  questionsEasy: number;
  questionsMedium: number;
  questionsHard: number;
  studyHours: number;
  understanding: number;
  completionPct: number;
}

interface DailyEfficiency {
  date: string;
  scheduledTasks: number;
  completedTasks: number;
  abandonedTimerStarts: number;
  timerUsedMinutes: number;
  timerTimeTakenMinutes: number;
  strictPenaltyPoints: number;
  overallEfficiencyPct: number;
}

interface EfficiencyTrendResponse {
  days: number;
  trend: DailyEfficiency[];
  averageOverallEfficiencyPct: number;
  averageTaskCompletionPct: number;
  averageTimerUsagePct: number;
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [dailyEfficiency, setDailyEfficiency] = useState<DailyEfficiency | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [efficiencyTrend, setEfficiencyTrend] = useState<DailyEfficiency[]>([]);
  const [trendSummary, setTrendSummary] = useState({
    averageOverallEfficiencyPct: 0,
    averageTaskCompletionPct: 0,
    averageTimerUsagePct: 0,
  });
  const [trendLoading, setTrendLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const fetchReports = useCallback(async () => {
    const res = await apiFetch('/reports');
    if (res.ok) {
      const data = await res.json();
      setReports(data);
    }
  }, []);

  const fetchDailyEfficiency = useCallback(async () => {
    const res = await apiFetch('/reports/efficiency');
    if (res.ok) {
      const data = await res.json();
      setDailyEfficiency(data);
    }
  }, []);

  const fetchEfficiencyTrend = useCallback(async (days: 7 | 30) => {
    try {
      setTrendLoading(true);
      const res = await apiFetch(`/reports/efficiency?days=${days}`);
      if (!res.ok) return;

      const data = (await res.json()) as EfficiencyTrendResponse;
      setEfficiencyTrend(Array.isArray(data.trend) ? data.trend : []);
      setTrendSummary({
        averageOverallEfficiencyPct: data.averageOverallEfficiencyPct || 0,
        averageTaskCompletionPct: data.averageTaskCompletionPct || 0,
        averageTimerUsagePct: data.averageTimerUsagePct || 0,
      });
    } finally {
      setTrendLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    fetchDailyEfficiency();
  }, [fetchReports, fetchDailyEfficiency]);

  useEffect(() => {
    fetchEfficiencyTrend(trendDays);
  }, [trendDays, fetchEfficiencyTrend]);

  const totalAbandonedStartsInTrend = useMemo(
    () => efficiencyTrend.reduce((sum, day) => sum + (day.abandonedTimerStarts || 0), 0),
    [efficiencyTrend],
  );

  const averagePenaltyInTrend = useMemo(() => {
    if (efficiencyTrend.length === 0) return 0;
    const totalPenalty = efficiencyTrend.reduce((sum, day) => sum + (day.strictPenaltyPoints || 0), 0);
    return totalPenalty / efficiencyTrend.length;
  }, [efficiencyTrend]);

  const avgAbandonedStartsPerDay = useMemo(() => {
    if (efficiencyTrend.length === 0) return 0;
    return totalAbandonedStartsInTrend / efficiencyTrend.length;
  }, [efficiencyTrend, totalAbandonedStartsInTrend]);

  const submitReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const tasksPlanned = Number(formData.get('tasksPlanned'));
    const tasksCompleted = Number(formData.get('tasksCompleted'));
    
    const data = {
      tasksPlanned,
      tasksCompleted,
      questionsEasy: Number(formData.get('questionsEasy')),
      questionsMedium: Number(formData.get('questionsMedium')),
      questionsHard: Number(formData.get('questionsHard')),
      studyHours: Number(formData.get('studyHours')),
      understanding: Number(formData.get('understanding')),
      completionPct: (tasksCompleted / tasksPlanned) * 100,
    };

    const res = await apiFetch('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast({ title: 'Report submitted successfully' });
      setShowForm(false);
      fetchReports();
      fetchDailyEfficiency();
      fetchEfficiencyTrend(trendDays);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Daily Reports</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Report'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall Efficiency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-sm text-muted-foreground">
                {dailyEfficiency
                  ? `${dailyEfficiency.completedTasks}/${dailyEfficiency.scheduledTasks} tasks • ${dailyEfficiency.timerUsedMinutes}/${Math.round(dailyEfficiency.timerTimeTakenMinutes)} min`
                  : 'Calculating...'}
              </p>
              {dailyEfficiency && (
                <p className="text-xs text-muted-foreground mt-1">
                  {dailyEfficiency.abandonedTimerStarts} abandoned starts • -{dailyEfficiency.strictPenaltyPoints.toFixed(1)} strict penalty
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{dailyEfficiency ? `${Math.round(dailyEfficiency.overallEfficiencyPct)}%` : '--'}</p>
              <p className="text-sm text-muted-foreground">efficiency</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Efficiency Trend</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={trendDays === 7 ? 'default' : 'outline'}
              onClick={() => setTrendDays(7)}
            >
              Weekly
            </Button>
            <Button
              type="button"
              size="sm"
              variant={trendDays === 30 ? 'default' : 'outline'}
              onClick={() => setTrendDays(30)}
            >
              Monthly
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Avg Efficiency</p>
              <p className="text-xl font-bold">{trendSummary.averageOverallEfficiencyPct.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Avg Task Completion</p>
              <p className="text-xl font-bold">{trendSummary.averageTaskCompletionPct.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Focus Penalty Signals</p>
              <p className="text-xl font-bold">{totalAbandonedStartsInTrend}</p>
              <p className="text-xs text-muted-foreground">{avgAbandonedStartsPerDay.toFixed(1)}/day • avg penalty: -{averagePenaltyInTrend.toFixed(1)}</p>
            </div>
          </div>

          {trendLoading ? (
            <div className="h-48 rounded-lg border grid place-items-center text-sm text-muted-foreground">
              Loading efficiency trend...
            </div>
          ) : efficiencyTrend.length === 0 ? (
            <div className="h-48 rounded-lg border grid place-items-center text-sm text-muted-foreground">
              No trend data available yet.
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div style={{ minWidth: trendDays === 30 ? '920px' : '100%' }}>
                <div className="relative h-56 rounded-lg border bg-muted/20 p-2">
                  <div className="absolute inset-2 pointer-events-none flex flex-col justify-between">
                    {[100, 75, 50, 25, 0].map((tick) => (
                      <div key={tick} className="relative border-t border-border/40">
                        <span className="absolute -top-2 -left-1 text-[10px] text-muted-foreground bg-background/70 px-1">
                          {tick}%
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className={`absolute inset-2 flex items-end ${trendDays === 30 ? 'gap-1.5' : 'gap-2'}`}>
                    {efficiencyTrend.map((day, index) => {
                      const barHeight = Math.max(3, Math.min(100, day.overallEfficiencyPct));
                      const label = new Date(day.date).toLocaleDateString('en-US', trendDays === 30
                        ? { month: 'short', day: 'numeric' }
                        : { weekday: 'short' });

                      const showMonthlyLabel = trendDays === 30
                        ? (index % 5 === 0 || index === efficiencyTrend.length - 1)
                        : true;

                      const barClass = day.overallEfficiencyPct >= 70
                        ? 'bg-emerald-500/85'
                        : day.overallEfficiencyPct >= 40
                          ? 'bg-amber-500/85'
                          : 'bg-rose-500/85';

                      return (
                        <div key={day.date} className="flex-1 min-w-0 flex flex-col items-center justify-end">
                          <div
                            className={`rounded-t-sm ${barClass} transition-all duration-300 ${trendDays === 30 ? 'w-2.5' : 'w-full max-w-6'}`}
                            style={{ height: `${barHeight}%` }}
                            title={`${day.date}: ${Math.round(day.overallEfficiencyPct)}% | abandoned starts: ${day.abandonedTimerStarts || 0} | penalty: -${(day.strictPenaltyPoints || 0).toFixed(1)}`}
                          />
                          <p className="text-[10px] text-muted-foreground mt-1 leading-none h-3">
                            {showMonthlyLabel ? label : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Daily Report</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitReport} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tasksPlanned">Tasks Planned</Label>
                  <Input id="tasksPlanned" name="tasksPlanned" type="number" required />
                </div>
                <div>
                  <Label htmlFor="tasksCompleted">Tasks Completed</Label>
                  <Input id="tasksCompleted" name="tasksCompleted" type="number" required />
                </div>
                <div>
                  <Label htmlFor="questionsEasy">Easy Questions</Label>
                  <Input id="questionsEasy" name="questionsEasy" type="number" required />
                </div>
                <div>
                  <Label htmlFor="questionsMedium">Medium Questions</Label>
                  <Input id="questionsMedium" name="questionsMedium" type="number" required />
                </div>
                <div>
                  <Label htmlFor="questionsHard">Hard Questions</Label>
                  <Input id="questionsHard" name="questionsHard" type="number" required />
                </div>
                <div>
                  <Label htmlFor="studyHours">Study Hours</Label>
                  <Input id="studyHours" name="studyHours" type="number" step="0.5" required />
                </div>
                <div>
                  <Label htmlFor="understanding">Understanding (1-5)</Label>
                  <Input id="understanding" name="understanding" type="number" min="1" max="5" required />
                </div>
              </div>
              <Button type="submit">Submit Report</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {new Date(report.date).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {report.tasksCompleted}/{report.tasksPlanned} tasks • {report.studyHours}h study
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{Math.round(report.completionPct)}%</p>
                  <p className="text-sm text-muted-foreground">completion</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
