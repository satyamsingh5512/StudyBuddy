import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  GraduationCap,
  Star,
  Calendar,
  Heart,
  Briefcase,
  Users,
  MessageSquare,
  TrendingUp,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';
import { soundManager } from '@/lib/sounds';

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: any;
  color: string;
  fields: Array<{
    label: string;
    fieldType: string;
    isRequired: boolean;
    config?: any;
  }>;
}

const templates: FormTemplate[] = [
  {
    id: 'student-feedback',
    name: 'Student Feedback Form',
    description: 'Collect feedback from students about courses and instructors',
    category: 'Education',
    icon: GraduationCap,
    color: '#3b82f6',
    fields: [
      { label: 'Student Name', fieldType: 'SHORT_TEXT', isRequired: true },
      { label: 'Course Name', fieldType: 'SHORT_TEXT', isRequired: true },
      {
        label: 'Overall Course Rating',
        fieldType: 'LINEAR_SCALE',
        isRequired: true,
        config: { min: 1, max: 5, minLabel: 'Poor', maxLabel: 'Excellent' },
      },
      {
        label: 'What did you like most about the course?',
        fieldType: 'LONG_TEXT',
        isRequired: false,
      },
      {
        label: 'What could be improved?',
        fieldType: 'LONG_TEXT',
        isRequired: false,
      },
      {
        label: 'Would you recommend this course?',
        fieldType: 'MULTIPLE_CHOICE',
        isRequired: true,
        config: { options: ['Yes', 'No', 'Maybe'] },
      },
    ],
  },
  {
    id: 'event-registration',
    name: 'Event Registration',
    description: 'Collect registrations for events, workshops, or webinars',
    category: 'Events',
    icon: Calendar,
    color: '#8b5cf6',
    fields: [
      { label: 'Full Name', fieldType: 'SHORT_TEXT', isRequired: true },
      { label: 'Email Address', fieldType: 'SHORT_TEXT', isRequired: true },
      {
        label: 'Which session will you attend?',
        fieldType: 'MULTIPLE_CHOICE',
        isRequired: true,
        config: { options: ['Morning Session', 'Afternoon Session', 'Full Day'] },
      },
      {
        label: 'Dietary Restrictions',
        fieldType: 'CHECKBOXES',
        isRequired: false,
        config: { options: ['Vegetarian', 'Vegan', 'Gluten-Free', 'No Restrictions'] },
      },
      {
        label: 'T-Shirt Size',
        fieldType: 'DROPDOWN',
        isRequired: false,
        config: { options: ['S', 'M', 'L', 'XL', 'XXL'] },
      },
      { label: 'Additional Comments', fieldType: 'LONG_TEXT', isRequired: false },
    ],
  },
  {
    id: 'customer-satisfaction',
    name: 'Customer Satisfaction Survey',
    description: 'Measure customer satisfaction and gather feedback',
    category: 'Business',
    icon: Star,
    color: '#eab308',
    fields: [
      {
        label: 'How satisfied are you with our service?',
        fieldType: 'RATING',
        isRequired: true,
      },
      {
        label: 'How likely are you to recommend us?',
        fieldType: 'LINEAR_SCALE',
        isRequired: true,
        config: { min: 0, max: 10, minLabel: 'Not Likely', maxLabel: 'Very Likely' },
      },
      {
        label: 'What do you value most?',
        fieldType: 'MULTIPLE_CHOICE',
        isRequired: true,
        config: { options: ['Quality', 'Price', 'Customer Service', 'Speed'] },
      },
      { label: 'How can we improve?', fieldType: 'LONG_TEXT', isRequired: false },
    ],
  },
  {
    id: 'job-application',
    name: 'Job Application Form',
    description: 'Collect applications for job openings',
    category: 'HR',
    icon: Briefcase,
    color: '#06b6d4',
    fields: [
      { label: 'Full Name', fieldType: 'SHORT_TEXT', isRequired: true },
      { label: 'Email Address', fieldType: 'SHORT_TEXT', isRequired: true },
      { label: 'Phone Number', fieldType: 'SHORT_TEXT', isRequired: true },
      {
        label: 'Position Applying For',
        fieldType: 'DROPDOWN',
        isRequired: true,
        config: { options: ['Software Engineer', 'Designer', 'Product Manager', 'Other'] },
      },
      {
        label: 'Years of Experience',
        fieldType: 'NUMBER',
        isRequired: true,
        config: { min: 0, max: 50 },
      },
      {
        label: 'Why do you want to join us?',
        fieldType: 'LONG_TEXT',
        isRequired: true,
      },
      {
        label: 'Available Start Date',
        fieldType: 'DATE',
        isRequired: false,
      },
    ],
  },
  {
    id: 'team-feedback',
    name: 'Team Feedback',
    description: 'Anonymous team feedback and pulse check',
    category: 'Team',
    icon: Users,
    color: '#10b981',
    fields: [
      {
        label: 'How engaged do you feel at work?',
        fieldType: 'LINEAR_SCALE',
        isRequired: true,
        config: { min: 1, max: 5, minLabel: 'Not Engaged', maxLabel: 'Very Engaged' },
      },
      {
        label: 'Do you have the resources you need?',
        fieldType: 'MULTIPLE_CHOICE',
        isRequired: true,
        config: { options: ['Yes', 'No', 'Partially'] },
      },
      {
        label: 'What\'s working well?',
        fieldType: 'LONG_TEXT',
        isRequired: false,
      },
      {
        label: 'What needs improvement?',
        fieldType: 'LONG_TEXT',
        isRequired: false,
      },
    ],
  },
  {
    id: 'contact-form',
    name: 'Contact Form',
    description: 'Simple contact form for your website',
    category: 'General',
    icon: MessageSquare,
    color: '#f59e0b',
    fields: [
      { label: 'Name', fieldType: 'SHORT_TEXT', isRequired: true },
      { label: 'Email', fieldType: 'SHORT_TEXT', isRequired: true },
      {
        label: 'Subject',
        fieldType: 'DROPDOWN',
        isRequired: true,
        config: { options: ['General Inquiry', 'Support', 'Feedback', 'Other'] },
      },
      { label: 'Message', fieldType: 'LONG_TEXT', isRequired: true },
    ],
  },
];

interface FormTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FormTemplatesModal({ isOpen, onClose }: FormTemplatesModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const categories = Array.from(new Set(templates.map((t) => t.category)));

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUseTemplate = async (template: FormTemplate) => {
    try {
      setCreating(true);
      soundManager.playClick();

      // Create form
      const formRes = await apiFetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template.name,
          description: template.description,
          primaryColor: template.color,
        }),
      });

      if (!formRes.ok) throw new Error('Failed to create form');

      const form = await formRes.json();

      // Create fields
      const fieldPromises = template.fields.map((field, index) =>
        apiFetch(`/api/form-fields/${form.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...field,
            order: index,
          }),
        })
      );

      await Promise.all(fieldPromises);

      toast({
        title: 'Success',
        description: `Created form from template: ${template.name}`,
      });

      navigate(`/forms/${form.id}/builder`);
      onClose();
    } catch (error) {
      console.error('Failed to create from template:', error);
      toast({
        title: 'Error',
        description: 'Failed to create form from template',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Form Templates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Start with a pre-built template and customize it to your needs
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b space-y-4">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="max-w-md"
          />
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template, index) => {
              const Icon = template.icon;
              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-5 hover:border-primary transition-colors h-full flex flex-col">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="p-3 rounded-lg"
                        style={{ backgroundColor: `${template.color}20` }}
                      >
                        <Icon className="h-6 w-6" style={{ color: template.color }} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{template.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {template.category}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">
                      {template.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span>{template.fields.length} fields</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleUseTemplate(template)}
                      disabled={creating}
                    >
                      Use Template
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No templates found</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
