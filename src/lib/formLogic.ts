// Conditional Logic Types
export interface FieldCondition {
  id: string;
  fieldId: string; // Field to check
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: string | string[];
}

export interface FieldLogic {
  action: 'show' | 'hide' | 'require';
  conditions: FieldCondition[];
  logicType: 'all' | 'any'; // all = AND, any = OR
}

// Evaluate if conditions are met
export function evaluateConditions(
  logic: FieldLogic,
  answers: Record<string, string | string[]>
): boolean {
  if (logic.conditions.length === 0) return true;

  const results = logic.conditions.map((condition) => {
    const answer = answers[condition.fieldId];
    
    switch (condition.operator) {
      case 'equals':
        if (Array.isArray(answer)) {
          return Array.isArray(condition.value) 
            ? condition.value.some(v => answer.includes(v))
            : answer.includes(condition.value as string);
        }
        return answer === condition.value;

      case 'not_equals':
        if (Array.isArray(answer)) {
          return Array.isArray(condition.value)
            ? !condition.value.some(v => answer.includes(v))
            : !answer.includes(condition.value as string);
        }
        return answer !== condition.value;

      case 'contains':
        if (Array.isArray(answer)) {
          return answer.some(a => 
            String(a).toLowerCase().includes(String(condition.value).toLowerCase())
          );
        }
        return String(answer || '').toLowerCase().includes(String(condition.value).toLowerCase());

      case 'greater_than':
        const numAnswer = parseFloat(String(answer));
        const numValue = parseFloat(String(condition.value));
        return !isNaN(numAnswer) && !isNaN(numValue) && numAnswer > numValue;

      case 'less_than':
        const numAns = parseFloat(String(answer));
        const numVal = parseFloat(String(condition.value));
        return !isNaN(numAns) && !isNaN(numVal) && numAns < numVal;

      case 'is_empty':
        return !answer || (Array.isArray(answer) && answer.length === 0) || answer === '';

      case 'is_not_empty':
        return !!answer && (!Array.isArray(answer) || answer.length > 0) && answer !== '';

      default:
        return false;
    }
  });

  return logic.logicType === 'all' ? results.every(r => r) : results.some(r => r);
}

// Check if field should be visible
export function isFieldVisible(
  field: { logic?: FieldLogic | null },
  answers: Record<string, string | string[]>
): boolean {
  if (!field.logic) return true;
  
  const conditionsMet = evaluateConditions(field.logic, answers);
  
  if (field.logic.action === 'show') {
    return conditionsMet;
  } else if (field.logic.action === 'hide') {
    return !conditionsMet;
  }
  
  return true;
}

// Check if field should be required
export function isFieldRequired(
  field: { isRequired: boolean; logic?: FieldLogic | null },
  answers: Record<string, string | string[]>
): boolean {
  // Base required state
  if (!field.isRequired && (!field.logic || field.logic.action !== 'require')) {
    return false;
  }
  
  // If has logic to make required
  if (field.logic && field.logic.action === 'require') {
    return evaluateConditions(field.logic, answers);
  }
  
  return field.isRequired;
}

// Get visible fields from form
export function getVisibleFields<T extends { id: string; logic?: FieldLogic | null }>(
  fields: T[],
  answers: Record<string, string | string[]>
): T[] {
  return fields.filter(field => isFieldVisible(field, answers));
}

// Validate answers considering logic
export function validateWithLogic(
  fields: Array<{ id: string; label: string; isRequired: boolean; logic?: FieldLogic | null }>,
  answers: Record<string, string | string[]>
): Record<string, string> {
  const errors: Record<string, string> = {};
  
  fields.forEach(field => {
    // Check if field is visible
    if (!isFieldVisible(field, answers)) {
      return; // Skip hidden fields
    }
    
    // Check if field is required (considering logic)
    const required = isFieldRequired(field, answers);
    const answer = answers[field.id];
    
    if (required && (!answer || (Array.isArray(answer) && answer.length === 0) || answer === '')) {
      errors[field.id] = `${field.label} is required`;
    }
  });
  
  return errors;
}
