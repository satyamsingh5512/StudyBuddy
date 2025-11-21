import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Webhook, ExternalLink, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { apiFetchJSON } from '@/config/api';

interface WebhookConfig {
  webhookUrl: string | null;
  webhookEnabled: boolean;
  webhookEvents: string[];
}

interface WebhookSettingsProps {
  formId: string;
  onClose: () => void;
}

export default function WebhookSettings({ formId, onClose }: WebhookSettingsProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<WebhookConfig>({
    webhookUrl: null,
    webhookEnabled: false,
    webhookEvents: ['response.created'],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    statusCode?: number;
    responseTime?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadConfig();
  }, [formId]);

  const loadConfig = async () => {
    try {
      const data = await apiFetchJSON<WebhookConfig>(`/api/webhooks/${formId}/config`);
      setConfig({
        webhookUrl: data.webhookUrl || '',
        webhookEnabled: data.webhookEnabled || false,
        webhookEvents: data.webhookEvents || ['response.created'],
      });
    } catch (error) {
      console.error('Failed to load webhook config:', error);
    }
  };

  const handleSave = async () => {
    if (!config.webhookUrl?.trim()) {
      toast({
        title: 'Webhook URL Required',
        description: 'Please enter a valid webhook URL',
        variant: 'destructive',
      });
      return;
    }

    if (!config.webhookUrl.match(/^https?:\/\/.+/)) {
      toast({
        title: 'Invalid URL',
        description: 'Webhook URL must start with http:// or https://',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiFetchJSON(`/api/webhooks/${formId}/config`, {
        method: 'PATCH',
        body: JSON.stringify(config),
      });

      toast({
        title: 'Webhook Settings Saved',
        description: 'Your webhook configuration has been updated',
      });

      onClose();
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save webhook settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config.webhookUrl?.trim()) {
      toast({
        title: 'Webhook URL Required',
        description: 'Please enter a valid webhook URL to test',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await apiFetchJSON<{
        success: boolean;
        statusCode?: number;
        responseTime?: number;
        error?: string;
      }>(`/api/webhooks/${formId}/test`, {
        method: 'POST',
        body: JSON.stringify({ url: config.webhookUrl }),
      });

      setTestResult(result);

      if (result.success) {
        toast({
          title: 'Webhook Test Successful',
          description: `Received ${result.statusCode} response in ${result.responseTime}ms`,
        });
      } else {
        toast({
          title: 'Webhook Test Failed',
          description: result.error || 'The webhook endpoint is not responding correctly',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || 'Failed to test webhook',
      });

      toast({
        title: 'Test Failed',
        description: error.message || 'Failed to test webhook endpoint',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const availableEvents = [
    { id: 'response.created', label: 'New Response Submitted' },
    { id: 'response.updated', label: 'Response Updated' },
    { id: 'form.published', label: 'Form Published' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background rounded-lg p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center gap-2 mb-4">
          <Webhook className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Webhook Settings</h2>
        </div>

        <div className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base font-medium">Enable Webhook</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Receive real-time notifications when events occur
              </p>
            </div>
            <Switch
              checked={config.webhookEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, webhookEnabled: checked })}
            />
          </div>

          {/* Webhook URL */}
          <div>
            <Label>Webhook URL</Label>
            <Input
              type="url"
              value={config.webhookUrl || ''}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              placeholder="https://your-app.com/api/webhooks/studybuddy"
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              StudyBuddy will send HTTP POST requests to this URL when events occur
            </p>
          </div>

          {/* Test Button */}
          {config.webhookUrl && (
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing Webhook...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Test Webhook
                  </>
                )}
              </Button>

              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg border ${
                    testResult.success
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {testResult.success ? 'Test Successful' : 'Test Failed'}
                      </p>
                      {testResult.success ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Status: {testResult.statusCode} • Response time: {testResult.responseTime}ms
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          {testResult.error}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Events Selection */}
          <div>
            <Label className="text-base">Events to Trigger</Label>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Select which events should trigger webhook notifications
            </p>
            <div className="space-y-2">
              {availableEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <input
                    type="checkbox"
                    id={event.id}
                    checked={config.webhookEvents.includes(event.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setConfig({
                          ...config,
                          webhookEvents: [...config.webhookEvents, event.id],
                        });
                      } else {
                        setConfig({
                          ...config,
                          webhookEvents: config.webhookEvents.filter((ev) => ev !== event.id),
                        });
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <Label htmlFor={event.id} className="flex-1 cursor-pointer">
                    {event.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook Payload Info */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Webhook Payload Format</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Webhooks are sent as POST requests with JSON payload containing:
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4 list-disc">
                  <li>event: Event type (e.g., "response.created")</li>
                  <li>formId: Form identifier</li>
                  <li>responseId: Response identifier (for response events)</li>
                  <li>data: Event-specific data with response details</li>
                  <li>timestamp: ISO 8601 timestamp</li>
                </ul>
              </div>
            </div>
          </div>

          {/* View Logs Link */}
          <Button
            variant="link"
            className="w-full justify-center"
            onClick={() => {
              window.open(`/forms/${formId}/webhook-logs`, '_blank');
            }}
          >
            View Webhook Logs
          </Button>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
