import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Settings,
  Eye,
  Save,
  ArrowLeft,
  Trash2,
  GripVertical,
  Copy,
  Link as LinkIcon,
  MoreVertical,
  Workflow,
  Webhook,
  UserPlus,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';
import { FIELD_TYPE_LABELS, FIELD_TYPE_ICONS, type FormField, type FieldType } from '@/types/forms';
import { type FieldLogic } from '@/lib/formLogic';
import LogicBuilder from '@/components/forms/LogicBuilder';
import WebhookSettings from '@/components/forms/WebhookSettings';
import CollaborationSettings from '@/components/forms/CollaborationSettings';

interface SortableFieldProps {
  field: FormField;
  onEdit: (field: FormField) => void;
  onDelete: (id: string) => void;
  onDuplicate: (field: FormField) => void;
  onConfigureLogic: (field: FormField) => void;
}

function SortableField({ field, onEdit, onDelete, onDuplicate, onConfigureLogic }: SortableFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = FIELD_TYPE_ICONS[field.fieldType];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-4 mb-3 cursor-pointer hover:border-primary transition-colors ${
        isDragging ? 'shadow-lg' : ''
      }`}
      onClick={() => onEdit(field)}
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical />
        </button>

        <Icon />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-medium flex items-center gap-2">
                {field.label}
                {field.isRequired && <span className="text-destructive text-sm">*</span>}
              </h4>
              {field.description && (
                <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {FIELD_TYPE_LABELS[field.fieldType]}
              </p>
            </div>

            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onConfigureLogic(field)}
                title="Conditional Logic"
              >
                <Workflow className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDuplicate(field)}
                title="Duplicate"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(field.id)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function FormBuilder() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [fieldSidebar, setFieldSidebar] = useState(true);
  const [showLogicBuilder, setShowLogicBuilder] = useState(false);
  const [logicField, setLogicField] = useState<FormField | null>(null);
  const [showWebhookSettings, setShowWebhookSettings] = useState(false);
  const [showCollaboration, setShowCollaboration] = useState(false);

  // Form settings state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [isAcceptingResponses, setIsAcceptingResponses] = useState(true);
  const [allowMultipleSubmissions, setAllowMultipleSubmissions] = useState(true);
  const [customSlug, setCustomSlug] = useState('');

  // Field editor state
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldDescription, setFieldDescription] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('SHORT_TEXT');
  const [isRequired, setIsRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState<string[]>(['']);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (formId && formId !== 'new') {
      loadForm();
    } else {
      setLoading(false);
      setTitle('Untitled Form');
    }
  }, [formId]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/forms/${formId}`);
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title);
        setDescription(data.description || '');
        setPrimaryColor(data.primaryColor || '#3b82f6');
        setIsAcceptingResponses(data.isAcceptingResponses);
        setAllowMultipleSubmissions(data.allowMultipleSubmissions);
        setCustomSlug(data.customSlug || '');
        loadFields();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load form',
          variant: 'destructive',
        });
        navigate('/forms');
      }
    } catch (error) {
      console.error('Failed to load form:', error);
      toast({
        title: 'Error',
        description: 'Failed to load form',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFields = async () => {
    try {
      const res = await apiFetch(`/api/form-fields/${formId}`);
      if (res.ok) {
        const data = await res.json();
        setFields(data);
      }
    } catch (error) {
      console.error('Failed to load fields:', error);
    }
  };

  const handleSaveForm = async () => {
    try {
      setSaving(true);
      soundManager.playClick();

      const formData = {
        title,
        description,
        primaryColor,
        isAcceptingResponses,
        allowMultipleSubmissions,
        customSlug: customSlug || undefined,
      };

      if (formId && formId !== 'new') {
        // Update existing form
        const res = await apiFetch(`/api/forms/${formId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          toast({ title: 'Success', description: 'Form updated successfully' });
          loadForm();
        } else {
          const error = await res.json();
          toast({
            title: 'Error',
            description: error.error || 'Failed to update form',
            variant: 'destructive',
          });
        }
      } else {
        // Create new form
        const res = await apiFetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          const data = await res.json();
          toast({ title: 'Success', description: 'Form created successfully' });
          navigate(`/forms/${data.id}/builder`);
        } else {
          const error = await res.json();
          toast({
            title: 'Error',
            description: error.error || 'Failed to create form',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Failed to save form:', error);
      toast({
        title: 'Error',
        description: 'Failed to save form',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = async (type: FieldType) => {
    soundManager.playClick();

    if (!formId || formId === 'new') {
      toast({
        title: 'Save Form First',
        description: 'Please save the form before adding fields',
      });
      return;
    }

    try {
      const res = await apiFetch(`/api/form-fields/${formId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `New ${FIELD_TYPE_LABELS[type]}`,
          fieldType: type,
          isRequired: false,
          config: type === 'MULTIPLE_CHOICE' || type === 'CHECKBOXES' || type === 'DROPDOWN'
            ? { options: ['Option 1', 'Option 2', 'Option 3'] }
            : type === 'LINEAR_SCALE'
            ? { min: 1, max: 5, minLabel: 'Low', maxLabel: 'High' }
            : {},
        }),
      });

      if (res.ok) {
        loadFields();
        toast({ title: 'Success', description: 'Field added successfully' });
      } else {
        const error = await res.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to add field',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to add field:', error);
      toast({
        title: 'Error',
        description: 'Failed to add field',
        variant: 'destructive',
      });
    }
  };

  const handleEditField = (field: FormField) => {
    soundManager.playClick();
    setSelectedField(field);
    setFieldLabel(field.label);
    setFieldDescription(field.description || '');
    setFieldType(field.fieldType);
    setIsRequired(field.isRequired);
    
    const config = field.config as Record<string, unknown> | null;
    if (config && (field.fieldType === 'MULTIPLE_CHOICE' || field.fieldType === 'CHECKBOXES' || field.fieldType === 'DROPDOWN')) {
      setFieldOptions((config.options as string[]) || ['']);
    } else {
      setFieldOptions(['']);
    }
    
    setShowFieldEditor(true);
  };

  const handleSaveField = async () => {
    if (!selectedField) return;

    try {
      soundManager.playClick();
      const config: Record<string, unknown> = {};

      if (fieldType === 'MULTIPLE_CHOICE' || fieldType === 'CHECKBOXES' || fieldType === 'DROPDOWN') {
        config.options = fieldOptions.filter((opt) => opt.trim() !== '');
      }

      const res = await apiFetch(`/api/form-fields/${selectedField.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: fieldLabel,
          description: fieldDescription || undefined,
          isRequired,
          config,
        }),
      });

      if (res.ok) {
        loadFields();
        setShowFieldEditor(false);
        toast({ title: 'Success', description: 'Field updated successfully' });
      } else {
        const error = await res.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update field',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to save field:', error);
      toast({
        title: 'Error',
        description: 'Failed to save field',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      soundManager.playClick();
      const res = await apiFetch(`/api/form-fields/${fieldId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadFields();
        toast({ title: 'Success', description: 'Field deleted successfully' });
      }
    } catch (error) {
      console.error('Failed to delete field:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete field',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicateField = async (field: FormField) => {
    try {
      soundManager.playClick();
      const res = await apiFetch(`/api/form-fields/${field.id}/duplicate`, {
        method: 'POST',
      });

      if (res.ok) {
        loadFields();
        toast({ title: 'Success', description: 'Field duplicated successfully' });
      }
    } catch (error) {
      console.error('Failed to duplicate field:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate field',
        variant: 'destructive',
      });
    }
  };

  const handleConfigureLogic = (field: FormField) => {
    soundManager.playClick();
    setLogicField(field);
    setShowLogicBuilder(true);
  };

  const handleSaveLogic = async (logic: FieldLogic | null) => {
    if (!logicField) return;
    
    try {
      soundManager.playClick();
      const res = await apiFetch(`/api/form-fields/${logicField.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logic
        })
      });

      if (res.ok) {
        loadFields();
        setShowLogicBuilder(false);
        setLogicField(null);
        toast({ 
          title: 'Success', 
          description: logic ? 'Logic saved successfully' : 'Logic removed successfully' 
        });
      }
    } catch (error) {
      console.error('Failed to save logic:', error);
      toast({
        title: 'Error',
        description: 'Failed to save logic',
        variant: 'destructive',
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);

      const newFields = arrayMove(fields, oldIndex, newIndex);
      setFields(newFields);

      // Update order on server
      try {
        await apiFetch(`/api/form-fields/${formId}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fieldOrders: newFields.map((f, idx) => ({ fieldId: f.id, order: idx })),
          }),
        });
      } catch (error) {
        console.error('Failed to reorder fields:', error);
        loadFields(); // Reload to get correct order
      }
    }
  };

  const handleCopyLink = () => {
    soundManager.playClick();
    const link = `${window.location.origin}/forms/f/${customSlug || formId}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Success', description: 'Form link copied to clipboard' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Left Sidebar - Field Types */}
      <AnimatePresence>
        {fieldSidebar && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="w-64 bg-background border-r p-4 overflow-y-auto"
          >
            <h3 className="font-semibold mb-4">Add Fields</h3>
            <div className="space-y-2">
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((type) => {
                const Icon = FIELD_TYPE_ICONS[type];
                return (
                  <Button
                    key={type}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleAddField(type)}
                  >
                    <Icon />
                    {FIELD_TYPE_LABELS[type]}
                  </Button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-background border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/forms')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold border-none focus:ring-0 max-w-md"
              placeholder="Form Title"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFieldSidebar(!fieldSidebar)}>
              <MoreVertical className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCollaboration(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowWebhookSettings(true)}>
              <Webhook className="h-4 w-4 mr-2" />
              Webhooks
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`/forms/f/${customSlug || formId}`, '_blank')}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button size="sm" onClick={handleSaveForm} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Form Preview */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {/* Form Header */}
            <Card className="p-8 mb-6" style={{ borderTopColor: primaryColor, borderTopWidth: '4px' }}>
              <h1 className="text-3xl font-bold mb-3">{title}</h1>
              {description && (
                <p className="text-muted-foreground whitespace-pre-wrap">{description}</p>
              )}
            </Card>

            {/* Fields */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {fields.map((field) => (
                  <SortableField
                    key={field.id}
                    field={field}
                    onEdit={handleEditField}
                    onDelete={handleDeleteField}
                    onDuplicate={handleDuplicateField}
                    onConfigureLogic={handleConfigureLogic}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {fields.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground">
                <p>No fields yet. Add some fields from the sidebar to get started!</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
          >
            <h2 className="text-xl font-semibold mb-4">Form Settings</h2>
            <div className="space-y-4">
              <div>
                <Label>Form Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div>
                <Label>Description</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background"
                  placeholder="Form description..."
                />
              </div>

              <div>
                <Label>Custom URL Slug (Optional)</Label>
                <Input
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="my-custom-form"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {window.location.origin}/forms/f/{customSlug || formId}
                </p>
              </div>

              <div>
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Accepting Responses</Label>
                <Switch checked={isAcceptingResponses} onCheckedChange={setIsAcceptingResponses} />
              </div>

              <div className="flex items-center justify-between">
                <Label>Allow Multiple Submissions</Label>
                <Switch checked={allowMultipleSubmissions} onCheckedChange={setAllowMultipleSubmissions} />
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="outline" onClick={() => setShowSettings(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    handleSaveForm();
                    setShowSettings(false);
                  }}
                  className="flex-1"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Field Editor Modal */}
      {showFieldEditor && selectedField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
          >
            <h2 className="text-xl font-semibold mb-4">Edit Field</h2>
            <div className="space-y-4">
              <div>
                <Label>Field Label</Label>
                <Input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} />
              </div>

              <div>
                <Label>Description (Optional)</Label>
                <Input value={fieldDescription} onChange={(e) => setFieldDescription(e.target.value)} />
              </div>

              <div className="flex items-center justify-between">
                <Label>Required Field</Label>
                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              </div>

              {(fieldType === 'MULTIPLE_CHOICE' || fieldType === 'CHECKBOXES' || fieldType === 'DROPDOWN') && (
                <div>
                  <Label>Options</Label>
                  <div className="space-y-2 mt-2">
                    {fieldOptions.map((option, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...fieldOptions];
                            newOptions[idx] = e.target.value;
                            setFieldOptions(newOptions);
                          }}
                          placeholder={`Option ${idx + 1}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFieldOptions(fieldOptions.filter((_, i) => i !== idx));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFieldOptions([...fieldOptions, ''])}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <Button variant="outline" onClick={() => setShowFieldEditor(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSaveField} className="flex-1">
                  Save Field
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Logic Builder Modal */}
      {showLogicBuilder && logicField && (
        <LogicBuilder
          field={logicField}
          allFields={fields}
          onSave={handleSaveLogic}
          onClose={() => {
            soundManager.playClick();
            setShowLogicBuilder(false);
            setLogicField(null);
          }}
        />
      )}

      {/* Webhook Settings Modal */}
      {showWebhookSettings && formId && (
        <WebhookSettings
          formId={formId}
          onClose={() => setShowWebhookSettings(false)}
        />
      )}

      {/* Collaboration Settings Modal */}
      {showCollaboration && formId && (
        <CollaborationSettings
          formId={formId}
          onClose={() => setShowCollaboration(false)}
        />
      )}
    </div>
  );
}
