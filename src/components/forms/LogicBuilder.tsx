import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { soundManager } from '@/lib/sounds';
import type { FormField } from '@/types/forms';

interface FieldCondition {
  id: string;
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: string | string[];
}

interface FieldLogic {
  action: 'show' | 'hide' | 'require';
  conditions: FieldCondition[];
  logicType: 'all' | 'any';
}

interface LogicBuilderProps {
  field: FormField;
  allFields: FormField[];
  onSave: (logic: FieldLogic | null) => void;
  onClose: () => void;
}

const OPERATORS = [
  { value: 'equals', label: 'equals', needsValue: true },
  { value: 'not_equals', label: 'does not equal', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'greater_than', label: 'is greater than', needsValue: true },
  { value: 'less_than', label: 'is less than', needsValue: true },
  { value: 'is_empty', label: 'is empty', needsValue: false },
  { value: 'is_not_empty', label: 'is not empty', needsValue: false },
];

const ACTIONS = [
  { value: 'show', label: 'Show this field', icon: Eye, color: 'text-green-600' },
  { value: 'hide', label: 'Hide this field', icon: EyeOff, color: 'text-red-600' },
  { value: 'require', label: 'Make this field required', icon: AlertCircle, color: 'text-yellow-600' },
];

export default function LogicBuilder({ field, allFields, onSave, onClose }: LogicBuilderProps) {
  const currentLogic = field.logic as FieldLogic | undefined;
  
  const [action, setAction] = useState<'show' | 'hide' | 'require'>(currentLogic?.action || 'show');
  const [logicType, setLogicType] = useState<'all' | 'any'>(currentLogic?.logicType || 'all');
  const [conditions, setConditions] = useState<FieldCondition[]>(
    currentLogic?.conditions || []
  );

  // Get fields that can be used in conditions (fields before this one)
  const availableFields = allFields.filter(f => 
    f.id !== field.id && f.order < field.order
  );

  const addCondition = () => {
    soundManager.playClick();
    if (availableFields.length === 0) return;

    const newCondition: FieldCondition = {
      id: `condition-${Date.now()}`,
      fieldId: availableFields[0].id,
      operator: 'equals',
      value: '',
    };
    setConditions([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    soundManager.playClick();
    setConditions(conditions.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<FieldCondition>) => {
    setConditions(conditions.map(c => 
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  const handleSave = () => {
    soundManager.playClick();
    
    if (conditions.length === 0) {
      onSave(null);
      return;
    }

    const logic: FieldLogic = {
      action,
      conditions,
      logicType,
    };

    onSave(logic);
  };

  const handleRemoveAllLogic = () => {
    soundManager.playClick();
    onSave(null);
  };

  const getFieldOptions = (fieldId: string) => {
    const targetField = allFields.find(f => f.id === fieldId);
    if (!targetField) return [];

    const config = targetField.config as Record<string, unknown>;
    
    if (['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'].includes(targetField.fieldType)) {
      return (config?.options as string[]) || [];
    }

    return [];
  };

  const selectedAction = ACTIONS.find(a => a.value === action);
  const ActionIcon = selectedAction?.icon || Eye;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Conditional Logic</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Show, hide, or require fields based on previous answers
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {availableFields.length === 0 ? (
            <Card className="p-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                No fields available for conditional logic. Add some fields before this one to use conditions.
              </p>
            </Card>
          ) : (
            <>
              {/* Action Selection */}
              <div className="space-y-3">
                <Label>Action</Label>
                <div className="grid grid-cols-1 gap-2">
                  {ACTIONS.map((actionOption) => {
                    const Icon = actionOption.icon;
                    return (
                      <button
                        key={actionOption.value}
                        onClick={() => setAction(actionOption.value as any)}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          action === actionOption.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${actionOption.color}`} />
                          <span className="font-medium">{actionOption.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Logic Type */}
              {conditions.length > 1 && (
                <div className="space-y-3">
                  <Label>When</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={logicType === 'all' ? 'default' : 'outline'}
                      onClick={() => setLogicType('all')}
                      className="flex-1"
                    >
                      All conditions match (AND)
                    </Button>
                    <Button
                      variant={logicType === 'any' ? 'default' : 'outline'}
                      onClick={() => setLogicType('any')}
                      className="flex-1"
                    >
                      Any condition matches (OR)
                    </Button>
                  </div>
                </div>
              )}

              {/* Conditions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Conditions</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addCondition}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Condition
                  </Button>
                </div>

                <AnimatePresence>
                  {conditions.length === 0 ? (
                    <Card className="p-6 text-center text-muted-foreground">
                      No conditions yet. Click "Add Condition" to get started.
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {conditions.map((condition, index) => {
                        const targetField = allFields.find(f => f.id === condition.fieldId);
                        const operator = OPERATORS.find(o => o.value === condition.operator);
                        const fieldOptions = getFieldOptions(condition.fieldId);

                        return (
                          <motion.div
                            key={condition.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                          >
                            <Card className="p-4">
                              <div className="flex items-start gap-3">
                                {index > 0 && (
                                  <Badge variant="outline" className="mt-2">
                                    {logicType === 'all' ? 'AND' : 'OR'}
                                  </Badge>
                                )}
                                <div className="flex-1 space-y-3">
                                  {/* Field Selection */}
                                  <div>
                                    <Label className="text-xs">When</Label>
                                    <Select
                                      value={condition.fieldId}
                                      onValueChange={(value) => 
                                        updateCondition(condition.id, { fieldId: value })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableFields.map(f => (
                                          <SelectItem key={f.id} value={f.id}>
                                            {f.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Operator Selection */}
                                  <div>
                                    <Label className="text-xs">Is</Label>
                                    <Select
                                      value={condition.operator}
                                      onValueChange={(value) => 
                                        updateCondition(condition.id, { 
                                          operator: value as any,
                                          value: '' // Reset value when operator changes
                                        })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {OPERATORS.map(op => (
                                          <SelectItem key={op.value} value={op.value}>
                                            {op.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Value Input (if needed) */}
                                  {operator?.needsValue && (
                                    <div>
                                      <Label className="text-xs">Value</Label>
                                      {fieldOptions.length > 0 ? (
                                        <Select
                                          value={condition.value as string}
                                          onValueChange={(value) => 
                                            updateCondition(condition.id, { value })
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select value..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {fieldOptions.map(option => (
                                              <SelectItem key={option} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Input
                                          value={condition.value as string}
                                          onChange={(e) => 
                                            updateCondition(condition.id, { value: e.target.value })
                                          }
                                          placeholder={
                                            targetField?.fieldType === 'NUMBER' 
                                              ? 'Enter a number...'
                                              : 'Enter a value...'
                                          }
                                          type={targetField?.fieldType === 'NUMBER' ? 'number' : 'text'}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeCondition(condition.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Preview */}
              {conditions.length > 0 && (
                <Card className="p-4 bg-muted/50">
                  <Label className="text-xs mb-2 block">Preview</Label>
                  <div className="flex items-start gap-2">
                    <ActionIcon className={`h-5 w-5 mt-0.5 ${selectedAction?.color}`} />
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{selectedAction?.label}</span>
                      <span className="text-muted-foreground"> when </span>
                      <span className="font-medium">
                        {logicType === 'all' ? 'all' : 'any'}
                      </span>
                      <span className="text-muted-foreground"> of these conditions are met:</span>
                      <ul className="mt-2 space-y-1">
                        {conditions.map((condition, index) => {
                          const targetField = allFields.find(f => f.id === condition.fieldId);
                          const operator = OPERATORS.find(o => o.value === condition.operator);
                          return (
                            <li key={condition.id} className="text-muted-foreground">
                              {index > 0 && <span className="font-medium">{logicType === 'all' ? 'AND ' : 'OR '}</span>}
                              <span className="font-medium text-foreground">{targetField?.label}</span>
                              {' '}{operator?.label}{' '}
                              {operator?.needsValue && (
                                <span className="font-medium text-foreground">"{condition.value}"</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex items-center justify-between">
          <div>
            {currentLogic && (
              <Button
                variant="outline"
                onClick={handleRemoveAllLogic}
                className="text-destructive hover:text-destructive"
              >
                Remove All Logic
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Logic
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
