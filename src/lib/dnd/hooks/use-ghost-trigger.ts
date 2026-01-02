"use client";

import * as React from "react";
import { useDndContext } from "../core/context";
import type { Coordinates, DragItem } from "../core/types";

interface UseGhostTriggerOptions {
  /** Whether ghost triggering is enabled */
  enabled: boolean;
  /** Container element for calculating insertion position */
  container: HTMLElement | null;
  /** Container ID for the ghost */
  containerId: string;
  /** Current mouse position relative to container */
  mousePosition: Coordinates | null;
  /** Whether the mouse is over this droppable */
  isOver: boolean;
  /** Whether this droppable can accept the current drag item */
  canDrop: boolean;
  /** Delay in ms before ghost appears */
  delay?: number;
}

interface UseGhostTriggerReturn {
  /** Whether ghost should be visible */
  shouldShowGhost: boolean;
  /** Insertion index for the ghost */
  ghostInsertionIndex: number | null;
  /** Manual trigger for immediate ghost display */
  triggerGhost: (insertionIndex: number) => void;
  /** Hide ghost immediately */
  hideGhost: () => void;
}

export function useGhostTrigger({
  enabled,
  container,
  containerId,
  mousePosition,
  isOver,
  canDrop,
  delay = 400,
}: UseGhostTriggerOptions): UseGhostTriggerReturn {
  const { state, setGhostIndicator } = useDndContext();
  const [localGhostState, setLocalGhostState] = React.useState<{
    visible: boolean;
    insertionIndex: number | null;
  }>({
    visible: false,
    insertionIndex: null,
  });

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Calculate dragged ID outside useMemo for dependency
  const draggedId = React.useMemo(() => 
    state.status === "dragging" && "item" in state ? state.item.id : null,
    [state.status, state.status === "dragging" && "item" in state ? state.item.id : null]
  );

  // Calculate insertion index based on mouse position - accounting for displaced elements
  const insertionIndex = React.useMemo(() => {
    if (!container || !mousePosition || !enabled || !isOver || !canDrop) return null;

    const items = Array.from(container.querySelectorAll("[data-dnd-id]")) as HTMLElement[];
    if (items.length === 0) return 0;

    const containerRect = container.getBoundingClientRect();
    const relativeY = mousePosition.y + containerRect.top;


    // Find insertion point by checking vertical midpoints using ORIGINAL positions
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rect = item.getBoundingClientRect();
      const itemId = item.getAttribute("data-dnd-id");
      
      // Check if this element is displaced by looking for our displacement data attribute
      const isDisplaced = item.hasAttribute("data-displaced");
      
      let originalTop = rect.top;
      let originalHeight = rect.height;
      let displacementOffset = 0;
      
      if (isDisplaced) {
        // If the item is displaced, we need to calculate its original position
        // Parse the transform to get the displacement offset
        const transform = item.style.transform;
        const translateMatch = transform.match(/translate3d\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
        
        if (translateMatch) {
          displacementOffset = parseFloat(translateMatch[2]);
          // Reverse the displacement to get original position
          originalTop = rect.top - displacementOffset;
        }
      }
      
      const originalMidpoint = originalTop + originalHeight / 2;


      if (relativeY < originalMidpoint) {
        return i;
      }
    }

    return items.length;
  }, [
    container, 
    mousePosition?.x, 
    mousePosition?.y, 
    enabled,
    containerId,
    draggedId,
    isOver,
    canDrop
  ]);

  // Clear timer helper
  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Hide ghost helper
  const hideGhost = React.useCallback(() => {
    clearTimer();
    setLocalGhostState({ visible: false, insertionIndex: null });
  }, [clearTimer]);

  // Trigger ghost immediately
  const triggerGhost = React.useCallback((index: number) => {
    clearTimer();
    setLocalGhostState({ visible: true, insertionIndex: index });
  }, [clearTimer]);

  // Main trigger logic - optimized dependencies to prevent infinite re-renders
  React.useEffect(() => {
    const isDragging = state.status === "dragging";
    const isCardDrag = isDragging && "item" in state && state.item.type === "card";
    
    if (!enabled || !isCardDrag) {
      if (localGhostState.visible) {
        hideGhost();
      }
      return;
    }

    const shouldTrigger = isOver && canDrop && insertionIndex !== null;
    const isCurrentlyVisible = localGhostState.visible;
    const currentGhostIndex = localGhostState.insertionIndex;

    if (shouldTrigger && !isCurrentlyVisible) {
      // Start timer to show ghost - capture insertionIndex at timer creation
      clearTimer();
      const capturedIndex = insertionIndex;
      timerRef.current = setTimeout(() => {
        setLocalGhostState({ visible: true, insertionIndex: capturedIndex });
      }, delay);
    } else if (shouldTrigger && isCurrentlyVisible && insertionIndex !== currentGhostIndex) {
      // Position changed while ghost is visible - restart timer for new position
      hideGhost();
      clearTimer();
      const capturedIndex = insertionIndex;
      timerRef.current = setTimeout(() => {
        setLocalGhostState({ visible: true, insertionIndex: capturedIndex });
      }, delay);
    } else if (!shouldTrigger && isCurrentlyVisible) {
      hideGhost();
    }
  }, [
    enabled,
    state.status,
    state.status === "dragging" && "item" in state ? state.item.type : null,
    isOver,
    canDrop,
    insertionIndex,
    localGhostState.visible,
    delay,
    clearTimer,
    hideGhost,
  ]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  // Cleanup when drag ends
  React.useEffect(() => {
    if (state.status !== "dragging") {
      hideGhost();
    }
  }, [state.status, hideGhost]);

  // Early exit if not enabled or not the target container (after all hooks are called)
  if (!enabled || !isOver || !canDrop) {
    return {
      shouldShowGhost: false,
      ghostInsertionIndex: null,
      triggerGhost: () => {},
      hideGhost: () => {},
    };
  }

  return {
    shouldShowGhost: localGhostState.visible,
    ghostInsertionIndex: localGhostState.insertionIndex,
    triggerGhost,
    hideGhost,
  };
}