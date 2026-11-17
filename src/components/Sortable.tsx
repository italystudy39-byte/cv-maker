"use client";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

/** Drag-and-drop reordering via @dnd-kit (spec 7.2). `render` gets drag-handle props to spread on a handle. */
export function SortableList<T>({
  items,
  getId,
  onReorder,
  render,
  layout = "vertical",
  className,
}: {
  items: T[];
  getId: (x: T) => string;
  onReorder: (items: T[]) => void;
  render: (x: T, handle: Record<string, unknown>, index: number) => ReactNode;
  layout?: "vertical" | "wrap";
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onReorder(arrayMove(items, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={layout === "wrap" ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {items.map((x, i) => (
            <Item key={ids[i]} id={ids[i]}>
              {(handle) => render(x, handle, i)}
            </Item>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function Item({ id, children }: { id: string; children: (handle: Record<string, unknown>) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.85 : 1, position: "relative" }}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}
