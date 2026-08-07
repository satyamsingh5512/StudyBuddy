import type { ReactNode } from 'react';
import type { DashboardWidgetId } from '@/lib/preferences';

interface DashboardWidgetLayoutProps {
  orderedVisibleIds: readonly DashboardWidgetId[];
  renderers: Partial<Record<DashboardWidgetId, ReactNode>>;
}

/** Renders only configurable dashboard widgets, in their normalized saved order. */
export default function DashboardWidgetLayout({
  orderedVisibleIds,
  renderers,
}: DashboardWidgetLayoutProps) {
  return (
    <>
      {orderedVisibleIds.map((id) => {
        const renderer = renderers[id];
        return renderer == null ? null : (
          <div key={id} data-widget-id={id}>
            {renderer}
          </div>
        );
      })}
    </>
  );
}
