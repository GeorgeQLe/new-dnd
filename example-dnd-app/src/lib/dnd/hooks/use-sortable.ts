"use client";

import * as React from "react";
import { useDraggable } from "./use-draggable";
import { useDroppable } from "./use-droppable";
import { useDndContext } from "../core/context";
import type { UniqueId, DragType, DropType } from "../core/types";
import { FLIP_ANIMATION_DURATION, FLIP_ANIMATION_EASING } from "../core/constants";

// ============================================================
// Types
// ============================================================
interface UseSortableConfig {
  id: UniqueId;
  type: DragType;
  index: number;
  containerId: UniqueId;
  data?: Record<string, unknown>;
  disabled?: boolean;
}

interface UseSortableReturn {
  // Combined refs
  setNodeRef: (element: HTMLElement | null) => void;
  setHandleRef: (element: HTMLElement | null) => void;

  // Draggable state
  isDragging: boolean;
  isPending: boolean;
  attributes: ReturnType<typeof useDraggable>["attributes"];
  listeners: ReturnType<typeof useDraggable>["listeners"];
  transform: { x: number; y: number } | null;

  // Sortable-specific
  isOver: boolean;
  isSorting: boolean;
  insertPosition: "before" | "after" | null;

  // CSS transition for FLIP
  transition: string | null;
  style: React.CSSProperties;
}

// ============================================================
// Hook Implementation
// ============================================================
export function useSortable({
  id,
  type,
  index,
  containerId,
  data = {},
  disabled = false,
}: UseSortableConfig): UseSortableReturn {
  const { state } = useDndContext();
  const nodeRef = React.useRef<HTMLElement | null>(null);

  // Determine the drop type based on drag type
  const dropType: DropType = type === "card" ? "list" : "board";

  // Use draggable hook with enhanced data
  const draggable = useDraggable({
    id,
    type,
    data: {
      ...data,
      index,
      containerId,
      listId: type === "card" ? containerId : undefined,
    },
    disabled,
  });

  // Use droppable for this sortable item (to detect when items are over it)
  const droppable = useDroppable({
    id: `sortable-${id}`,
    type: dropType,
    accepts: [type],
    disabled,
  });

  // Combine refs
  const setNodeRef = React.useCallback(
    (element: HTMLElement | null) => {
      nodeRef.current = element;
      draggable.setNodeRef(element);
      droppable.setNodeRef(element);
    },
    [draggable, droppable]
  );

  // Is any item of the same type being sorted?
  const isSorting = React.useMemo(() => {
    return state.status === "dragging" && state.item.type === type;
  }, [state, type]);

  // Is this specific item the insert target?
  const isOver = React.useMemo(() => {
    if (state.status !== "dragging") return false;
    if (!state.insertPosition) return false;

    // Check if this item's container matches and the index matches
    return (
      state.insertPosition.listId === containerId &&
      state.insertPosition.index === index
    );
  }, [state, containerId, index]);

  // Get the insert indicator position
  const insertPosition = React.useMemo(() => {
    if (!isOver || state.status !== "dragging" || !state.insertPosition) {
      return null;
    }
    return state.insertPosition.indicator;
  }, [isOver, state]);

  // FLIP transition (applied when not the dragging item but sorting is happening)
  const transition = React.useMemo(() => {
    if (isSorting && !draggable.isDragging) {
      return `transform ${FLIP_ANIMATION_DURATION}ms ${FLIP_ANIMATION_EASING}`;
    }
    return null;
  }, [isSorting, draggable.isDragging]);

  // Combined style object for consumers
  const style = React.useMemo<React.CSSProperties>(() => {
    const styles: React.CSSProperties = {};

    // Apply transform when dragging (but not if we're the dragged item since overlay handles that)
    if (draggable.transform && !draggable.isDragging) {
      styles.transform = `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`;
    }

    // Apply transition for non-dragging items during sort
    if (transition) {
      styles.transition = transition;
    }

    // Visual feedback for dragging item - keep in place as placeholder
    if (draggable.isDragging) {
      styles.opacity = 0.3; // Low opacity placeholder
      // No transform - keep original position to maintain layout space
    }

    return styles;
  }, [draggable.transform, draggable.isDragging, transition]);

  return {
    setNodeRef,
    setHandleRef: draggable.setHandleRef,
    isDragging: draggable.isDragging,
    isPending: draggable.isPending,
    attributes: draggable.attributes,
    listeners: draggable.listeners,
    transform: draggable.transform,
    isOver,
    isSorting,
    insertPosition,
    transition,
    style,
  };
}
