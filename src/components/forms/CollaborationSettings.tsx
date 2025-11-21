import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  Mail,
  Crown,
  Edit3,
  Eye,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { apiFetchJSON } from '@/config/api';

interface Collaborator {
  id: string;
  userId: string;
  role: 'VIEWER' | 'EDITOR' | 'ADMIN';
  invitedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

interface CollaborationSettingsProps {
  formId: string;
  onClose: () => void;
}

export default function CollaborationSettings({ formId, onClose }: CollaborationSettingsProps) {
  const { toast } = useToast();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [activeTab, setActiveTab] = useState<'collaborators' | 'activity'>('collaborators');

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'VIEWER' | 'EDITOR' | 'ADMIN'>('EDITOR');

  useEffect(() => {
    loadData();
  }, [formId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [collab, activity] = await Promise.all([
        apiFetchJSON<Collaborator[]>(`/api/collaborators/${formId}`),
        apiFetchJSON<ActivityLog[]>(`/api/collaborators/${formId}/activity`),
      ]);
      setCollaborators(collab);
      setActivityLogs(activity);
    } catch (error: any) {
      toast({
        title: 'Failed to Load Data',
        description: error.message || 'Could not load collaboration data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setInviting(true);
    try {
      const newCollaborator = await apiFetchJSON<Collaborator>(`/api/collaborators/${formId}`, {
        method: 'POST',
        body: JSON.stringify({
          userEmail: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      setCollaborators([...collaborators, newCollaborator]);
      setInviteEmail('');

      toast({
        title: 'Collaborator Added',
        description: `${inviteEmail} has been added as ${inviteRole.toLowerCase()}`,
      });

      // Reload activity logs
      const activity = await apiFetchJSON<ActivityLog[]>(`/api/collaborators/${formId}/activity`);
      setActivityLogs(activity);
    } catch (error: any) {
      toast({
        title: 'Invite Failed',
        description: error.message || 'Failed to add collaborator',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (collaboratorId: string, newRole: 'VIEWER' | 'EDITOR' | 'ADMIN') => {
    try {
      const updated = await apiFetchJSON<Collaborator>(`/api/collaborators/${formId}/${collaboratorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });

      setCollaborators(
        collaborators.map((c) => (c.id === collaboratorId ? updated : c))
      );

      toast({
        title: 'Role Updated',
        description: `Role changed to ${newRole.toLowerCase()}`,
      });

      // Reload activity logs
      const activity = await apiFetchJSON<ActivityLog[]>(`/api/collaborators/${formId}/activity`);
      setActivityLogs(activity);
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (collaboratorId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from this form?`)) return;

    try {
      await apiFetchJSON(`/api/collaborators/${formId}/${collaboratorId}`, {
        method: 'DELETE',
      });

      setCollaborators(collaborators.filter((c) => c.id !== collaboratorId));

      toast({
        title: 'Collaborator Removed',
        description: `${userName} has been removed`,
      });

      // Reload activity logs
      const activity = await apiFetchJSON<ActivityLog[]>(`/api/collaborators/${formId}/activity`);
      setActivityLogs(activity);
    } catch (error: any) {
      toast({
        title: 'Remove Failed',
        description: error.message || 'Failed to remove collaborator',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-500';
      case 'EDITOR':
        return 'bg-blue-500';
      case 'VIEWER':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
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
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background rounded-lg p-6 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center gap-2 mb-6">
          <Users className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Share & Collaborate</h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'collaborators'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('collaborators')}
          >
            Collaborators ({collaborators.length})
          </button>
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'activity'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'collaborators' ? (
            <div className="space-y-6">
              {/* Invite Form */}
              <div className="p-4 border rounded-lg bg-accent/50">
                <Label className="text-base font-medium mb-3 block">Invite New Collaborator</Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleInvite()}
                    />
                  </div>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="px-3 py-2 rounded-md border border-input bg-background"
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="EDITOR">Editor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <Button onClick={handleInvite} disabled={inviting} className="whitespace-nowrap">
                    {inviting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Inviting...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite
                      </>
                    )}
                  </Button>
                </div>

                {/* Role Descriptions */}
                <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Eye className="h-3 w-3 mt-0.5" />
                    <div>
                      <span className="font-medium">Viewer:</span> Can view form and responses
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Edit3 className="h-3 w-3 mt-0.5" />
                    <div>
                      <span className="font-medium">Editor:</span> Can edit form and view responses
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Crown className="h-3 w-3 mt-0.5" />
                    <div>
                      <span className="font-medium">Admin:</span> Full access including managing collaborators
                    </div>
                  </div>
                </div>
              </div>

              {/* Collaborators List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : collaborators.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No collaborators yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Invite team members to work on this form together
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {collaborators.map((collab) => (
                    <motion.div
                      key={collab.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      {collab.user.avatar ? (
                        <img
                          src={collab.user.avatar}
                          alt={collab.user.name}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {collab.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{collab.user.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          {collab.user.email}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Added {formatDate(collab.invitedAt)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={collab.role}
                          onChange={(e) => handleUpdateRole(collab.id, e.target.value as any)}
                          className={`px-3 py-1 rounded-md text-sm font-medium text-white ${getRoleBadgeColor(
                            collab.role
                          )}`}
                        >
                          <option value="VIEWER">Viewer</option>
                          <option value="EDITOR">Editor</option>
                          <option value="ADMIN">Admin</option>
                        </select>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(collab.id, collab.user.name)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Activity Logs */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No activity yet</p>
                </div>
              ) : (
                activityLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 p-3 border rounded-lg"
                  >
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">{log.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(log.createdAt)}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
