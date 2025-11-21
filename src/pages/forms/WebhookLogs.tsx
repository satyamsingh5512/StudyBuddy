import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { apiFetchJSON } from '@/config/api';
import PageLoader from '@/components/PageLoader';

interface WebhookLog {
  id: string;
  formId: string;
  url: string;
  event: string;
  payload: any;
  statusCode: number | null;
  responseBody: string | null;
  error: string | null;
  attemptNumber: number;
  createdAt: string;
}

export default function WebhookLogs() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, [formId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await apiFetchJSON<WebhookLog[]>(`/api/webhooks/${formId}/logs`);
      setLogs(data);
    } catch (error: any) {
      toast({
        title: 'Failed to Load Logs',
        description: error.message || 'Could not load webhook logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (log: WebhookLog) => {
    if (log.error) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    }

    if (log.statusCode && log.statusCode >= 200 && log.statusCode < 300) {
      return (
        <Badge variant="default" className="gap-1 bg-green-500">
          <CheckCircle2 className="h-3 w-3" />
          Success
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
          {log.statusCode || 'Unknown'}
        </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background">{/* Header */}
        <div className="bg-background border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${formId}/builder`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Form
              </Button>
              <h1 className="text-2xl font-bold">Webhook Logs</h1>
            </div>
            <Button variant="outline" size="sm" onClick={loadLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {logs.length === 0 ? (
            <Card className="p-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Webhook Logs Yet</h3>
              <p className="text-muted-foreground">
                Webhook delivery logs will appear here once events are triggered
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className="p-4 cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(log)}
                          <Badge variant="outline">{log.event}</Badge>
                          <Badge variant="secondary">Attempt {log.attemptNumber}</Badge>
                          <span className="text-sm text-muted-foreground ml-auto">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-xs truncate">{log.url}</span>
                          </div>

                          {log.error && (
                            <div className="flex items-start gap-2 mt-2 p-2 bg-destructive/10 rounded">
                              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                              <span className="text-sm text-destructive">{log.error}</span>
                            </div>
                          )}

                          {log.statusCode && (
                            <div className="text-xs text-muted-foreground">
                              Status Code: {log.statusCode}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Log Detail Modal */}
        {selectedLog && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedLog(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-background rounded-lg p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Webhook Log Details</h2>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedLog)}
                    <Badge variant="outline">{selectedLog.event}</Badge>
                    <Badge variant="secondary">Attempt {selectedLog.attemptNumber}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">URL</h3>
                  <div className="p-3 bg-muted rounded font-mono text-xs break-all">
                    {selectedLog.url}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Timestamp</h3>
                  <div className="p-3 bg-muted rounded text-sm">
                    {new Date(selectedLog.createdAt).toLocaleString('en-US', {
                      dateStyle: 'full',
                      timeStyle: 'long',
                    })}
                  </div>
                </div>

                {selectedLog.error && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 text-destructive">Error</h3>
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                      {selectedLog.error}
                    </div>
                  </div>
                )}

                {selectedLog.statusCode && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Status Code</h3>
                    <div className="p-3 bg-muted rounded text-sm">
                      {selectedLog.statusCode}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium mb-2">Request Payload</h3>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>

                {selectedLog.responseBody && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Response Body</h3>
                    <pre className="p-3 bg-muted rounded text-xs overflow-x-auto max-h-48">
                      {selectedLog.responseBody}
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedLog(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
  );
}
