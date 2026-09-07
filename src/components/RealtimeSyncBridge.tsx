'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { startRealtimeSync } from '@/lib/realtimeSync';

export default function RealtimeSyncBridge() {
  const queryClient = useQueryClient();

  useEffect(() => startRealtimeSync(queryClient), [queryClient]);
  return null;
}
