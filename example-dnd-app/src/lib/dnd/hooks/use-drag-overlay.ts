"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useDndContext } from "../core/context";
import type { Coordinates, DragItem } from "../core/types";

// ============================================================
// Types
// ============================================================
interface UseDragOverlayReturn {
  /** The currently dragged item, or null if not dragging */
  activeItem: DragItem | null;
  /** Current transform offset from origin */
  transform: Coordinates | null;
  /** Current absolute position (origin + transform) */
  position: Coordinates | null;
  /** Whether an item is currently being dragged */
  isDragging: boolean;
  /** Portal component for rendering overlay content */
  Portal: React.FC<{ children: React.ReactNode }>;
}

// ============================================================
// Hook Implementation
// ============================================================
export function useDragOverlay(): UseDragOverlayReturn {
  const { state } = useDndContext();
  const [mounted, setMounted] = React.useState(false);

  // Handle SSR - only render portal after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Extract active item from state
  const activeItem = React.useMemo(() => {
    if (state.status === "dragging") {
      return state.item;
    }
    return null;
  }, [state]);

  // Extract transform from state
  const transform = React.useMemo(() => {
    if (state.status === "dragging") {
      return state.delta;
    }
    return null;
  }, [state]);

  // Calculate absolute position
  const position = React.useMemo(() => {
    if (state.status === "dragging") {
      return state.current;
    }
    return null;
  }, [state]);

  const isDragging = state.status === "dragging";

  // Portal component for rendering
  const Portal: React.FC<{ children: React.ReactNode }> = React.useCallback(
    ({ children }) => {
      if (!mounted || typeof document === "undefined") {
        return null;
      }
      return createPortal(children, document.body);
    },
    [mounted]
  );

  return {
    activeItem,
    transform,
    position,
    isDragging,
    Portal,
  };
}

// ============================================================
// Utility hook for getting initial rect of dragged element
// ============================================================
export function useDraggedElementRect(): DOMRect | null {
  const { state, getDraggable } = useDndContext();

  return React.useMemo(() => {
    if (state.status !== "dragging" && state.status !== "pending") {
      return null;
    }

    const draggable = getDraggable(state.item.id);
    if (!draggable) {
      return null;
    }

    return draggable.element.getBoundingClientRect();
  }, [state, getDraggable]);
};