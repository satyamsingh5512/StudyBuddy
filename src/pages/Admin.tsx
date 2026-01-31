import { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/use-toast';
import { API_URL } from '../config/api';

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  activeToday: number;
  tempEmailUsers: number;
  timestamp: string;
}

export default function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stats`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load admin stats',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sendDailyStats = async () => {
    if (!confirm('Send daily stats email to all verified users?')) {
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`${API_URL}/admin/send-daily-stats`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to send emails');
      }

      const data = await response.json();
      toast({
        title: 'Success',
        description: `Sent ${data.successCount} emails successfully. ${data.failCount} failed. ${data.skippedTempEmails || 0} temp emails skipped.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send daily stats emails',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Admin Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Users</div>
            <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats?.totalUsers || 0}
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Verified Users</div>
            <div className="text-4xl font-bold text-green-600 dark:text-green-400">
              {stats?.verifiedUsers || 0}
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Active Today</div>
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
              {stats?.activeToday || 0}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Temp Email Users</div>
            <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">
              {stats?.tempEmailUsers || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Users with disposable email addresses
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Valid Email Users</div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {(stats?.totalUsers || 0) - (stats?.tempEmailUsers || 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Users with permanent email addresses
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Email Actions</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Send daily study summary emails to all verified users with their completed tasks, schedules, study time, and motivational quotes.
              </p>
              <Button
                onClick={sendDailyStats}
                disabled={sending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {sending ? 'Sending...' : 'Send Daily Stats to All Users'}
              </Button>
            </div>
          </div>
        </Card>

        {stats && (
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Last updated: {new Date(stats.timestamp).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
