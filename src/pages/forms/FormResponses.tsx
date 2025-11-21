import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Download, 
  Trash2, 
  Star, 
  Flag, 
  Search,
  MoreVertical,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';
import type { Form, FormResponse } from '@/types/forms';

export default function FormResponses() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);

  useEffect(() => {
    loadForm();
    loadResponses();
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

  const loadResponses = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/form-responses/${formId}`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load responses',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load responses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load responses',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStar = async (responseId: string) => {
    try {
      soundManager.playClick();
      const res = await apiFetch(`/api/form-responses/${responseId}/star`, {
        method: 'PATCH',
      });

      if (res.ok) {
        loadResponses();
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  const handleToggleFlag = async (responseId: string) => {
    try {
      soundManager.playClick();
      const res = await apiFetch(`/api/form-responses/${responseId}/flag`, {
        method: 'PATCH',
      });

      if (res.ok) {
        loadResponses();
      }
    } catch (error) {
      console.error('Failed to toggle flag:', error);
    }
  };

  const handleDeleteResponse = async (responseId: string) => {
    if (!confirm('Are you sure you want to delete this response?')) return;

    try {
      soundManager.playClick();
      const res = await apiFetch(`/api/form-responses/${responseId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Response deleted successfully' });
        loadResponses();
        if (selectedResponse?.id === responseId) {
          setSelectedResponse(null);
        }
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete response',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to delete response:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete response',
        variant: 'destructive',
      });
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
        a.download = `${form?.title || 'form'}-responses.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: 'Success', description: 'Responses exported to CSV' });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to export responses',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast({
        title: 'Error',
        description: 'Failed to export responses',
        variant: 'destructive',
      });
    }
  };

  const handleExportJSON = async () => {
    try {
      soundManager.playClick();
      const res = await apiFetch(`/api/form-analytics/${formId}/export/json`);
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${form?.title || 'form'}-responses.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: 'Success', description: 'Responses exported to JSON' });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to export responses',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to export JSON:', error);
      toast({
        title: 'Error',
        description: 'Failed to export responses',
        variant: 'destructive',
      });
    }
  };

  const filteredResponses = responses.filter((response) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      response.responderName?.toLowerCase().includes(searchLower) ||
      response.responderEmail?.toLowerCase().includes(searchLower) ||
      response.id.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">Loading responses...</div>
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
            <p className="text-sm text-muted-foreground">
              {responses.length} {responses.length === 1 ? 'response' : 'responses'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            <FileJson className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, or ID..."
          className="pl-9"
        />
      </div>

      {/* Responses List */}
      {filteredResponses.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            {responses.length === 0
              ? 'No responses yet. Share your form to start collecting responses!'
              : 'No responses match your search.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredResponses.map((response, index) => (
            <motion.div
              key={response.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={`p-4 cursor-pointer hover:border-primary transition-colors ${
                  selectedResponse?.id === response.id ? 'border-primary' : ''
                }`}
                onClick={() => {
                  soundManager.playClick();
                  setSelectedResponse(response);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">
                        {response.responderName || 'Anonymous'}
                      </h3>
                      {response.isStarred && (
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      )}
                      {response.isFlagged && (
                        <Flag className="h-4 w-4 fill-red-500 text-red-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {response.responderEmail && (
                        <span>{response.responderEmail}</span>
                      )}
                      <span>
                        {format(new Date(response.submittedAt), 'MMM d, yyyy h:mm a')}
                      </span>
                      <Badge variant="outline">{response.answers?.length || 0} answers</Badge>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStar(response.id);
                        }}
                      >
                        <Star className="h-4 w-4 mr-2" />
                        {response.isStarred ? 'Unstar' : 'Star'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFlag(response.id);
                        }}
                      >
                        <Flag className="h-4 w-4 mr-2" />
                        {response.isFlagged ? 'Unflag' : 'Flag'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteResponse(response.id);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Response Detail Modal */}
      {selectedResponse && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedResponse(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">
                  {selectedResponse.responderName || 'Anonymous'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedResponse.submittedAt), 'MMMM d, yyyy h:mm a')}
                </p>
                {selectedResponse.responderEmail && (
                  <p className="text-sm text-muted-foreground">{selectedResponse.responderEmail}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedResponse(null)}>
                Close
              </Button>
            </div>

            <div className="space-y-4">
              {selectedResponse.answers?.map((answer) => {
                // Check if this is a file upload field
                let isFileUpload = false;
                let fileData: any = null;
                
                try {
                  if (answer.valueText && answer.valueText.startsWith('{')) {
                    const parsed = JSON.parse(answer.valueText);
                    if (parsed.url && parsed.publicId) {
                      isFileUpload = true;
                      fileData = parsed;
                    }
                  }
                } catch (e) {
                  // Not a JSON file upload
                }

                return (
                  <div key={answer.id} className="border-b pb-4">
                    <h3 className="font-medium mb-2">{answer.field?.label}</h3>
                    {isFileUpload && fileData ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                          <div className="text-3xl">📎</div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{fileData.originalName}</p>
                            <p className="text-xs text-muted-foreground">
                              {(fileData.fileSize / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <a
                            href={fileData.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            <Button size="sm" variant="outline">
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground whitespace-pre-wrap">
                        {answer.valueText || 'No answer provided'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Metadata */}
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-medium mb-3">Response Metadata</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">IP Address:</span>
                  <p className="font-mono">{selectedResponse.ipAddress || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Browser:</span>
                  <p className="truncate">{selectedResponse.userAgent || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Response ID:</span>
                  <p className="font-mono text-xs">{selectedResponse.id}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
