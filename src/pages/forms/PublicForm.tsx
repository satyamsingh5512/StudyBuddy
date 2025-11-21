import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';
import { isFieldVisible, isFieldRequired, getVisibleFields } from '@/lib/formLogic';
import type { Form, FormField, FieldType } from '@/types/forms';

export default function PublicForm() {
  const { identifier } = useParams<{ identifier: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [responderName, setResponderName] = useState('');
  const [responderEmail, setResponderEmail] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadForm();
  }, [identifier]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/form-responses/public/${identifier}`);
      if (res.ok) {
        const data = await res.json();
        setForm(data);
      } else {
        toast({
          title: 'Error',
          description: 'Form not found',
          variant: 'destructive',
        });
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

  const validateField = (field: FormField, value: string | string[] | undefined): string | null => {
    // Check if field is dynamically required based on logic
    const isDynamicallyRequired = isFieldRequired(field, answers);
    const isRequired = field.isRequired || isDynamicallyRequired;
    
    if (isRequired && (!value || (Array.isArray(value) && value.length === 0) || value === '')) {
      return `${field.label} is required`;
    }

    if (!value || value === '') return null;

    const config = field.config as Record<string, unknown> | null;

    // Number validation
    if (field.fieldType === 'NUMBER' && config) {
      const num = parseFloat(value as string);
      if (Number.isNaN(num)) return 'Must be a valid number';
      if (config.min !== undefined && num < (config.min as number)) {
        return `Must be at least ${config.min}`;
      }
      if (config.max !== undefined && num > (config.max as number)) {
        return `Must be at most ${config.max}`;
      }
    }

    // Text length validation
    if ((field.fieldType === 'SHORT_TEXT' || field.fieldType === 'LONG_TEXT') && config && typeof value === 'string') {
      if (config.minLength && value.length < (config.minLength as number)) {
        return `Must be at least ${config.minLength} characters`;
      }
      if (config.maxLength && value.length > (config.maxLength as number)) {
        return `Must be at most ${config.maxLength} characters`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();

    if (!form) return;

    // Get all fields and filter only visible ones based on conditional logic
    const newErrors: Record<string, string> = {};
    const allFields = [
      ...(form.fields || []),
      ...(form.sections?.flatMap((s) => s.fields || []) || []),
    ];

    // Only validate fields that are currently visible
    const visibleFields = getVisibleFields(allFields, answers);

    visibleFields.forEach((field) => {
      const error = validateField(field, answers[field.id]);
      if (error) {
        newErrors[field.id] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch(`/api/form-responses/public/${identifier}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          responderName: responderName || undefined,
          responderEmail: responderEmail || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmitted(true);
        toast({
          title: 'Success',
          description: data.message || 'Thank you for your response!',
        });
      } else {
        const error = await res.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to submit response',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to submit form:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit response',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    // Check if field should be visible based on conditional logic
    if (!isFieldVisible(field, answers)) {
      return null;
    }

    const error = errors[field.id];
    // Check if field is dynamically required
    const isDynamicallyRequired = isFieldRequired(field, answers);
    const showRequired = field.isRequired || isDynamicallyRequired;

    switch (field.fieldType) {
      case 'SHORT_TEXT':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {showRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <Input
              value={(answers[field.id] as string) || ''}
              onChange={(e) => {
                setAnswers({ ...answers, [field.id]: e.target.value });
                setErrors({ ...errors, [field.id]: '' });
              }}
              placeholder={(field.config as Record<string, unknown>)?.placeholder as string || ''}
              className={error ? 'border-destructive' : ''}
            />
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );

      case 'LONG_TEXT':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {showRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <textarea
              value={(answers[field.id] as string) || ''}
              onChange={(e) => {
                setAnswers({ ...answers, [field.id]: e.target.value });
                setErrors({ ...errors, [field.id]: '' });
              }}
              placeholder={(field.config as Record<string, unknown>)?.placeholder as string || ''}
              rows={4}
              className={`w-full px-3 py-2 rounded-md border ${error ? 'border-destructive' : 'border-input'} bg-background`}
            />
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );

      case 'MULTIPLE_CHOICE':
        const options = (field.config as Record<string, unknown>)?.options as string[] || [];
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {showRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <div className="space-y-2">
              {options.map((option) => (
                <label key={option} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={field.id}
                    value={option}
                    checked={answers[field.id] === option}
                    onChange={(e) => {
                      setAnswers({ ...answers, [field.id]: e.target.value });
                      setErrors({ ...errors, [field.id]: '' });
                    }}
                    className="h-4 w-4"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );

      case 'CHECKBOXES':
        const checkOptions = (field.config as Record<string, unknown>)?.options as string[] || [];
        const selectedOptions = (answers[field.id] as string[]) || [];
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {showRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <div className="space-y-2">
              {checkOptions.map((option) => (
                <label key={option} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option)}
                    onChange={(e) => {
                      const newSelected = e.target.checked
                        ? [...selectedOptions, option]
                        : selectedOptions.filter((o) => o !== option);
                      setAnswers({ ...answers, [field.id]: newSelected });
                      setErrors({ ...errors, [field.id]: '' });
                    }}
                    className="h-4 w-4"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );

      case 'NUMBER':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {showRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <Input
              type="number"
              value={(answers[field.id] as string) || ''}
              onChange={(e) => {
                setAnswers({ ...answers, [field.id]: e.target.value });
                setErrors({ ...errors, [field.id]: '' });
              }}
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );

      case 'DATE':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {showRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <Input
              type="date"
              value={(answers[field.id] as string) || ''}
              onChange={(e) => {
                setAnswers({ ...answers, [field.id]: e.target.value });
                setErrors({ ...errors, [field.id]: '' });
              }}
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );

      case 'TIME':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {showRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <Input
              type="time"
              value={(answers[field.id] as string) || ''}
              onChange={(e) => {
                setAnswers({ ...answers, [field.id]: e.target.value });
                setErrors({ ...errors, [field.id]: '' });
              }}
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );

      case 'LINEAR_SCALE':
        const min = (field.config as Record<string, unknown>)?.min as number || 1;
        const max = (field.config as Record<string, unknown>)?.max as number || 5;
        const minLabel = (field.config as Record<string, unknown>)?.minLabel as string;
        const maxLabel = (field.config as Record<string, unknown>)?.maxLabel as string;
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {showRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <div className="flex items-center gap-4">
              {minLabel && <span className="text-sm text-muted-foreground">{minLabel}</span>}
              <div className="flex gap-2">
                {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setAnswers({ ...answers, [field.id]: value.toString() });
                      setErrors({ ...errors, [field.id]: '' });
                    }}
                    className={`h-10 w-10 rounded-full border-2 transition-all ${
                      answers[field.id] === value.toString()
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input hover:border-primary'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              {maxLabel && <span className="text-sm text-muted-foreground">{maxLabel}</span>}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );

      case 'RATING':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {showRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setAnswers({ ...answers, [field.id]: value.toString() });
                    setErrors({ ...errors, [field.id]: '' });
                  }}
                  className={`text-2xl ${
                    parseInt(answers[field.id] as string) >= value
                      ? 'text-yellow-500'
                      : 'text-gray-300'
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading form...</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Form Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This form doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/')}>Go to Homepage</Button>
        </Card>
      </div>
    );
  }

  if (!form.isAcceptingResponses) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Form Closed</h2>
          <p className="text-muted-foreground mb-4">
            This form is no longer accepting responses.
          </p>
          <Button onClick={() => navigate('/')}>Go to Homepage</Button>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md"
        >
          <Card className="p-8 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-6">
              {form.confirmationMessage || 'Your response has been recorded.'}
            </p>
            {form.allowMultipleSubmissions && (
              <Button
                onClick={() => {
                  setSubmitted(false);
                  setAnswers({});
                  setErrors({});
                  setResponderName('');
                  setResponderEmail('');
                }}
                className="w-full"
              >
                Submit Another Response
              </Button>
            )}
          </Card>
        </motion.div>
      </div>
    );
  }

  const allFields = [
    ...(form.fields || []),
    ...(form.sections?.flatMap((s) => s.fields || []) || []),
  ];

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Form Header */}
          <Card className="p-8 mb-6" style={{ borderTopColor: form.primaryColor || undefined, borderTopWidth: '4px' }}>
            {form.logoUrl && (
              <img src={form.logoUrl} alt="Logo" className="h-12 mb-4" />
            )}
            {form.heroBadge && (
              <span className="inline-block px-3 py-1 text-sm rounded-full bg-primary/10 text-primary mb-3">
                {form.heroBadge}
              </span>
            )}
            <h1 className="text-3xl font-bold mb-3">{form.title}</h1>
            {form.description && (
              <p className="text-muted-foreground whitespace-pre-wrap">{form.description}</p>
            )}
          </Card>

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Responder Info (for public forms) */}
            {form.accessType === 'PUBLIC' && (
              <Card className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label>Your Name (Optional)</Label>
                  <Input
                    value={responderName}
                    onChange={(e) => setResponderName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Your Email (Optional)</Label>
                  <Input
                    type="email"
                    value={responderEmail}
                    onChange={(e) => setResponderEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              </Card>
            )}

            {/* Render sections and fields */}
            {form.sections && form.sections.length > 0 ? (
              form.sections.map((section) => (
                <Card key={section.id} className="p-6 space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">{section.title}</h2>
                    {section.description && (
                      <p className="text-muted-foreground">{section.description}</p>
                    )}
                  </div>
                  {section.fields?.map((field) => renderField(field))}
                </Card>
              ))
            ) : (
              <Card className="p-6 space-y-6">
                {allFields.map((field) => renderField(field))}
              </Card>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="flex-1"
                style={{ backgroundColor: form.primaryColor || undefined }}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </form>

          {/* Footer */}
          <div className="text-center mt-6 text-sm text-muted-foreground">
            <p>Powered by StudyBuddy Forms</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
