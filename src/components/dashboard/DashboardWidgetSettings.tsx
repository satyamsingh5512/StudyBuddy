'use client';

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DASHBOARD_WIDGETS, type DashboardWidgetId } from '@/lib/preferences';

interface Props {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
  onChange(order: DashboardWidgetId[], hidden: DashboardWidgetId[]): void;
}

function SortableWidget({ id, hidden, onToggle }: { id: DashboardWidgetId; hidden: boolean; onToggle(): void }) {
  const widget = DASHBOARD_WIDGETS.find((item) => item.id === id)!;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3 ${isDragging ? 'z-10 opacity-70 shadow-lg' : ''}`}>
      <button type="button" className="touch-none rounded-lg p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Reorder ${widget.label}`} {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{widget.label}</p>
        <p className="text-xs text-muted-foreground">{widget.description}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onToggle} aria-pressed={!hidden} aria-label={`${hidden ? 'Show' : 'Hide'} ${widget.label}`} className="gap-2">
        {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        <span className="hidden sm:inline">{hidden ? 'Hidden' : 'Shown'}</span>
      </Button>
    </li>
  );
}

export default function DashboardWidgetSettings({ order, hidden, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as DashboardWidgetId);
    const to = order.indexOf(over.id as DashboardWidgetId);
    if (from >= 0 && to >= 0) onChange(arrayMove(order, from, to), hidden);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {order.map((id) => <SortableWidget key={id} id={id} hidden={hidden.includes(id)} onToggle={() => onChange(order, hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id])} />)}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
