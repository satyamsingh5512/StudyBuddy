/**
 * Optimistic Mutation Hook
 * File: src/hooks/useOptimisticMutation.ts
 * 
 * Provides optimistic UI updates with automatic rollback on error.
 * Works with Jotai atoms for state management.
 * 
 * Usage:
 *   const { mutate, isLoading } = useOptimisticMutation({
 *     atom: todosAtom,
 *     mutationFn: (todo) => apiFetch('/api/todos', { method: 'POST', body: todo }),
 *     optimisticUpdate: (todos, newTodo) => [...todos, { ...newTodo, id: 'temp-' + Date.now() }],
 *     onSuccess: (data, todos) => todos.map(t => t.id.startsWith('temp-') ? data : t),
 *   });
 */

import { useState, useCallback } from 'react';
import { useAtom, WritableAtom } from 'jotai';

interface OptimisticMutationConfig<TData, TVariables, TAtomValue> {
  atom: WritableAtom<TAtomValue, [TAtomValue], void>;
  mutationFn: (variables: TVariables) => Promise<TData>;
  optimisticUpdate: (currentValue: TAtomValue, variables: TVariables) => TAtomValue;
  onSuccess?: (data: TData, currentValue: TAtomValue, variables: TVariables) => TAtomValue;
  onError?: (error: Error, previousValue: TAtomValue, variables: TVariables) => void;
  rollbackOnError?: boolean;
}

interface MutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData | undefined>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useOptimisticMutation<TData, TVariables, TAtomValue>(
  config: OptimisticMutationConfig<TData, TVariables, TAtomValue>
): MutationResult<TData, TVariables> {
  const {
    atom,
    mutationFn,
    optimisticUpdate,
    onSuccess,
    onError,
    rollbackOnError = true,
  } = config;

  const [atomValue, setAtomValue] = useAtom(atom);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(null);

      // Store previous value for rollback
      const previousValue = atomValue;

      // Apply optimistic update immediately
      const optimisticValue = optimisticUpdate(atomValue, variables);
      setAtomValue(optimisticValue);

      try {
        // Perform actual mutation
        const data = await mutationFn(variables);

        // Apply success transformation if provided
        if (onSuccess) {
          const finalValue = onSuccess(data, optimisticValue, variables);
          setAtomValue(finalValue);
        }

        setIsLoading(false);
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        // Rollback on error
        if (rollbackOnError) {
          setAtomValue(previousValue);
        }

        // Call error handler
        if (onError) {
          onError(error, previousValue, variables);
        }

        setIsLoading(false);
        throw error;
      }
    },
    [atomValue, setAtomValue, mutationFn, optimisticUpdate, onSuccess, onError, rollbackOnError]
  );

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | undefined> => {
      try {
        return await mutateAsync(variables);
      } catch {
        return undefined;
      }
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    mutate,
    mutateAsync,
    isLoading,
    error,
    reset,
  };
}

export default useOptimisticMutation;
