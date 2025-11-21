import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  Search,
  MoreVertical,
  Copy,
  Archive,
  Trash2,
  ExternalLink,
  Edit,
  BarChart3,
  Power,
  PowerOff,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';
import type { Form } from '@/types/forms';
import { formatDistanceToNow } from 'date-fns';
import FormTemplatesModal from '@/components/forms/FormTemplatesModal';

export default function FormsDashboard() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [showTemplates, setShowTemplates] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadForms();
  }, [filter]);

  const loadForms = async () => {
    try {
      setLoading(true);
      const archived = filter === 'archived' ? 'true' : 'false';
      const res = await apiFetch(`/api/forms?archived=${archived}`);
      if (res.ok) {
        const data = await res.json();
        setForms(data);
      }
    } catch (error) {
      console.error('Failed to load forms:', error);
      toast({
        title: 'Error',
        description: 'Failed to load forms',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateForm = async () => {
    soundManager.playClick();
    try {
      const res = await apiFetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Form',
          description: '',
        }),
      });

      if (res.ok) {
        const newForm = await res.json();
        toast({
          title: 'Success',
          description: 'Form created successfully',
        });
        navigate(`/forms/${newForm.id}/builder`);
      }
    } catch (error) {
      console.error('Failed to create form:', error);
      toast({
        title: 'Error',
        description: 'Failed to create form',
        variant: 'destructive',
      });
    }
  };

  const handleToggleResponses = async (formId: string) => {
    soundManager.playClick();
    try {
      const res = await apiFetch(`/api/forms/${formId}/toggle-responses`, {
        method: 'PATCH',
      });

      if (res.ok) {
        await loadForms();
        toast({
          title: 'Success',
          description: 'Form status updated',
        });
      }
    } catch (error) {
      console.error('Failed to toggle responses:', error);
      toast({
        title: 'Error',
        description: 'Failed to update form',
        variant: 'destructive',
      });
    }
  };

  const handleArchive = async (formId: string) => {
    soundManager.playClick();
    try {
      const res = await apiFetch(`/api/forms/${formId}/archive`, {
        method: 'PATCH',
      });

      if (res.ok) {
        await loadForms();
        toast({
          title: 'Success',
          description: filter === 'archived' ? 'Form unarchived' : 'Form archived',
        });
      }
    } catch (error) {
      console.error('Failed to archive form:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive form',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (formId: string) => {
    soundManager.playClick();
    try {
      const res = await apiFetch(`/api/forms/${formId}/duplicate`, {
        method: 'POST',
      });

      if (res.ok) {
        await loadForms();
        toast({
          title: 'Success',
          description: 'Form duplicated successfully',
        });
      }
    } catch (error) {
      console.error('Failed to duplicate form:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate form',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (formId: string) => {
    soundManager.playClick();
    if (!confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await apiFetch(`/api/forms/${formId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await loadForms();
        toast({
          title: 'Success',
          description: 'Form deleted successfully',
        });
      }
    } catch (error) {
      console.error('Failed to delete form:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete form',
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = (form: Form) => {
    soundManager.playClick();
    const link = `${window.location.origin}/f/${form.customSlug || form.id}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link copied',
      description: 'Form link copied to clipboard',
    });
  };

  const filteredForms = forms.filter((form) => {
    const matchesSearch = form.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'all') return matchesSearch && !form.archivedAt;
    if (filter === 'active') return matchesSearch && form.isAcceptingResponses && !form.archivedAt;
    if (filter === 'archived') return matchesSearch && form.archivedAt;
    return matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Forms</h1>
            <p className="text-muted-foreground mt-1">Create and manage your forms</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowTemplates(true)} size="lg" variant="outline" className="gap-2">
              <FileText className="h-5 w-5" />
              Templates
            </Button>
            <Button onClick={handleCreateForm} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Create Form
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search forms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => {
                soundManager.playClick();
                setFilter('all');
              }}
            >
              All
            </Button>
            <Button
              variant={filter === 'active' ? 'default' : 'outline'}
              onClick={() => {
                soundManager.playClick();
                setFilter('active');
              }}
            >
              Active
            </Button>
            <Button
              variant={filter === 'archived' ? 'default' : 'outline'}
              onClick={() => {
                soundManager.playClick();
                setFilter('archived');
              }}
            >
              Archived
            </Button>
          </div>
        </div>
      </div>

      {/* Forms Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 h-48 animate-pulse bg-muted" />
          ))}
        </div>
      ) : filteredForms.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No forms found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? 'No forms match your search'
              : filter === 'archived'
                ? "You don't have any archived forms"
                : 'Get started by creating your first form'}
          </p>
          {!searchQuery && filter === 'all' && (
            <Button onClick={handleCreateForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Form
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredForms.map((form, index) => (
            <motion.div
              key={form.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-6 hover:shadow-lg transition-all">
                {/* Form Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    {form.heroBadge && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded mb-2 inline-block">
                        {form.heroBadge}
                      </span>
                    )}
                    <h3 className="font-semibold text-lg truncate mb-1">{form.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {form.description || 'No description'}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/forms/${form.id}/builder`)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/forms/${form.id}/responses`)}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Responses
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/forms/${form.id}/analytics`)}>
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Analytics
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyLink(form)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(form.id)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleToggleResponses(form.id)}>
                        {form.isAcceptingResponses ? (
                          <>
                            <PowerOff className="h-4 w-4 mr-2" />
                            Close Form
                          </>
                        ) : (
                          <>
                            <Power className="h-4 w-4 mr-2" />
                            Open Form
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleArchive(form.id)}>
                        <Archive className="h-4 w-4 mr-2" />
                        {form.archivedAt ? 'Unarchive' : 'Archive'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(form.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Form Stats */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    <span>{form._count?.responses || 0} responses</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {form.isAcceptingResponses ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <div className="h-2 w-2 rounded-full bg-gray-400" />
                        <span>Closed</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      soundManager.playClick();
                      navigate(`/forms/${form.id}/edit`);
                    }}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      soundManager.playClick();
                      navigate(`/forms/${form.id}/responses`);
                    }}
                  >
                    <BarChart3 className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      soundManager.playClick();
                      window.open(`/f/${form.customSlug || form.id}`, '_blank');
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>

                {/* Updated time */}
                <div className="text-xs text-muted-foreground mt-3">
                  Updated {formatDistanceToNow(new Date(form.updatedAt), { addSuffix: true })}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Templates Modal */}
      <FormTemplatesModal isOpen={showTemplates} onClose={() => setShowTemplates(false)} />
    </div>
  );
}
