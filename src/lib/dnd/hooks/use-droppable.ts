"use client";

import * as React from "react";
import { useDndContext } from "../core/context";
import type { UniqueId, DropType, DragType, DragItem } from "../core/types";

// ============================================================
// Types
// ============================================================
interface UseDroppableConfig {
  id: UniqueId;
  type: DropType;
  accepts: DragType[];
  disabled?: boolean;
}

interface UseDroppableReturn {
  setNodeRef: (element: HTMLElement | null) => void;
  isOver: boolean;
  canDrop: boolean;
  activeItem: DragItem | null;
}

// ============================================================
// Hook Implementation
// ============================================================
export function useDroppable({
  id,
  type,
  accepts,
  disabled = false,
}: UseDroppableConfig): UseDroppableReturn {
  const { state, registerDroppable, unregisterDroppable } = useDndContext();
  const nodeRef = React.useRef<HTMLElement | null>(null);

  // Cache for sortable items to avoid querySelectorAll on every drag move
  const sortableItemsCache = React.useRef<HTMLElement[]>([]);
  const cacheTimestamp = React.useRef<number>(0);
  const CACHE_TTL = 100; // ms - refresh cache if older than this

  // Getter function that returns cached items
  const getSortableItems = React.useCallback((): HTMLElement[] => {
    const now = Date.now();
    const element = nodeRef.current;

    if (!element) {
      sortableItemsCache.current = [];
      return sortableItemsCache.current;
    }

    // Refresh cache if stale
    if (now - cacheTimestamp.current > CACHE_TTL) {
      sortableItemsCache.current = Array.from(
        element.querySelectorAll("[data-dnd-id]")
      ) as HTMLElement[];
      cacheTimestamp.current = now;
    }

    return sortableItemsCache.current;
  }, []);

  // Get active item from state
  const activeItem = React.useMemo(() => {
    if (state.status === "dragging" || state.status === "pending") {
      return state.item;
    }
    return null;
  }, [state]);

  // Can this droppable accept the current drag item?
  const canDrop = React.useMemo(() => {
    if (!activeItem || disabled) return false;
    return accepts.includes(activeItem.type);
  }, [activeItem, accepts, disabled]);

  // Is the drag currently over this droppable?
  const isOver = React.useMemo(() => {
    if (state.status !== "dragging") return false;
    return state.over?.id === id && canDrop;
  }, [state, id, canDrop]);

  // Register on mount and when dependencies change
  React.useEffect(() => {
    if (nodeRef.current) {
      registerDroppable({
        id,
        type,
        element: nodeRef.current,
        accepts,
        disabled,
        getSortableItems,
      });
    }

    return () => unregisterDroppable(id);
  }, [id, type, accepts, disabled, registerDroppable, unregisterDroppable, getSortableItems]);

  // Ref setter
  const setNodeRef = React.useCallback((element: HTMLElement | null) => {
    nodeRef.current = element;

    // Re-register if element changes
    if (element) {
      registerDroppable({
        id,
        type,
        element,
        accepts,
        disabled,
        getSortableItems,
      });
    }
  }, [id, type, accepts, disabled, registerDroppable, getSortableItems]);

  return {
    setNodeRef,
    isOver,
    canDrop,
    activeItem,
  };
}
