import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  Users,
  Clock,
  BarChart3,
  PieChart,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';
import type { Form } from '@/types/forms';

interface AnalyticsSummary {
  totalResponses: number;
  averageCompletionTime: number;
  lastResponseDate: string | null;
  responsesLast24h: number;
  responsesLast7d: number;
  responsesLast30d: number;
  timeSeriesData: Array<{ date: string; count: number }>;
}

interface FieldAnalytics {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  totalResponses: number;
  uniqueValues: number;
  distribution?: Record<string, { count: number; percentage: number }>;
  numericStats?: {
    average: number;
    median: number;
    min: number;
    max: number;
    sum: number;
  };
  textStats?: {
    averageLength: number;
    minLength: number;
    maxLength: number;
  };
}

export default function FormAnalytics() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [fieldAnalytics, setFieldAnalytics] = useState<FieldAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForm();
    loadSummary();
    loadFieldAnalytics();
  }, [formId]);

  const loadForm = async () => {
    try {
      const res = await apiFetch(`/api/forms/${formId}`);
      if (res.ok) {
        const data = await res.json();
        setForm(data);
      }
    } catch (error) {
      console.error('Failed to load form:', error);
    }
  };

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/form-analytics/${formId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load analytics',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFieldAnalytics = async () => {
    try {
      const res = await apiFetch(`/api/forms/${formId}`);
      if (res.ok) {
        const formData = await res.json();
        const allFields = [
          ...(formData.fields || []),
          ...(formData.sections?.flatMap((s: any) => s.fields || []) || []),
        ];

        const analyticsPromises = allFields.map(async (field: any) => {
          const res = await apiFetch(`/api/form-analytics/${formId}/field/${field.id}`);
          if (res.ok) {
            return res.json();
          }
          return null;
        });

        const results = await Promise.all(analyticsPromises);
        setFieldAnalytics(results.filter((r) => r !== null));
      }
    } catch (error) {
      console.error('Failed to load field analytics:', error);
    }
  };

  const handleExportCSV = async () => {
    try {
      soundManager.playClick();
      const res = await apiFetch(`/api/form-analytics/${formId}/export/csv`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${form?.title || 'form'}-analytics.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: 'Success', description: 'Analytics exported to CSV' });
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast({
        title: 'Error',
        description: 'Failed to export analytics',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/forms')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Forms
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{form?.title}</h1>
            <p className="text-sm text-muted-foreground">Form Analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/forms/${formId}/responses`)}>
            View Responses
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Responses</p>
                <p className="text-2xl font-bold">{summary?.totalResponses || 0}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last 24 Hours</p>
                <p className="text-2xl font-bold">{summary?.responsesLast24h || 0}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Completion Time</p>
                <p className="text-2xl font-bold">
                  {summary?.averageCompletionTime
                    ? `${Math.round(summary.averageCompletionTime / 60)}m`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Response</p>
                <p className="text-lg font-bold">
                  {summary?.lastResponseDate
                    ? format(new Date(summary.lastResponseDate), 'MMM d')
                    : 'Never'}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Response Timeline */}
      {summary && summary.timeSeriesData && summary.timeSeriesData.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Response Timeline (Last 30 Days)</h2>
          <div className="h-64 flex items-end gap-2">
            {summary.timeSeriesData.map((point, index) => {
              const maxCount = Math.max(...summary.timeSeriesData.map((p) => p.count));
              const height = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                    style={{ height: `${height}%`, minHeight: point.count > 0 ? '4px' : '0' }}
                    title={`${format(new Date(point.date), 'MMM d')}: ${point.count} responses`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(point.date), 'd')}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Field Analytics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Field-by-Field Analytics</h2>
        <div className="space-y-4">
          {fieldAnalytics.map((field, index) => (
            <motion.div
              key={field.fieldId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-lg">{field.fieldLabel}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{field.fieldType}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {field.totalResponses} responses
                      </span>
                    </div>
                  </div>
                </div>

                {/* Choice Field Distribution */}
                {field.distribution && (
                  <div className="space-y-3">
                    {Object.entries(field.distribution)
                      .sort(([, a], [, b]) => b.count - a.count)
                      .map(([value, stats]) => (
                        <div key={value}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">{value}</span>
                            <span className="text-sm text-muted-foreground">
                              {stats.count} ({stats.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${stats.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Numeric Field Stats */}
                {field.numericStats && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="text-lg font-semibold">{field.numericStats.average.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Median</p>
                      <p className="text-lg font-semibold">{field.numericStats.median.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Min</p>
                      <p className="text-lg font-semibold">{field.numericStats.min}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max</p>
                      <p className="text-lg font-semibold">{field.numericStats.max}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sum</p>
                      <p className="text-lg font-semibold">{field.numericStats.sum}</p>
                    </div>
                  </div>
                )}

                {/* Text Field Stats */}
                {field.textStats && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Avg. Length</p>
                      <p className="text-lg font-semibold">
                        {field.textStats.averageLength.toFixed(0)} chars
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Shortest</p>
                      <p className="text-lg font-semibold">{field.textStats.minLength} chars</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Longest</p>
                      <p className="text-lg font-semibold">{field.textStats.maxLength} chars</p>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {fieldAnalytics.length === 0 && (
        <Card className="p-12 text-center">
          <PieChart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            No analytics available yet. Collect some responses to see insights!
          </p>
        </Card>
      )}
    </div>
  );
}
