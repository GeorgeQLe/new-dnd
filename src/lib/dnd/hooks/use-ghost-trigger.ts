"use client";

import * as React from "react";
import { useDndContext } from "../core/context";
import type { Coordinates, DragItem, GhostAxis } from "../core/types";

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
  /** Axis for ghost calculation - vertical for cards, horizontal for lists */
  axis?: GhostAxis;
  /** Current index of the dragged item (for same-position filtering) */
  draggedItemIndex?: number;
  /** Whether to skip adjacent positions (default: true for horizontal/lists) */
  skipAdjacentPositions?: boolean;
  /** Custom item selector (default: "[data-dnd-id]") */
  itemSelector?: string;
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
  axis = "vertical",
  draggedItemIndex,
  skipAdjacentPositions,
  itemSelector = "[data-dnd-id]",
}: UseGhostTriggerOptions): UseGhostTriggerReturn {
  const { state, setGhostIndicator, setListGhostIndicator } = useDndContext();
  const [localGhostState, setLocalGhostState] = React.useState<{
    visible: boolean;
    insertionIndex: number | null;
  }>({
    visible: false,
    insertionIndex: null,
  });

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Determine if we should skip adjacent positions (default: true for horizontal/lists)
  const shouldSkipAdjacent = skipAdjacentPositions ?? axis === "horizontal";

  // Calculate dragged ID outside useMemo for dependency
  const draggedId = React.useMemo(() =>
    state.status === "dragging" && "item" in state ? state.item.id : null,
    [state.status, state.status === "dragging" && "item" in state ? state.item.id : null]
  );

  // Calculate insertion index based on mouse position - accounting for displaced elements
  const insertionIndex = React.useMemo(() => {
    if (!container || !mousePosition || !enabled || !isOver || !canDrop) return null;

    const items = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
    if (items.length === 0) return 0;

    const containerRect = container.getBoundingClientRect();
    const isHorizontal = axis === "horizontal";

    // Use appropriate coordinate based on axis
    const relativePos = isHorizontal
      ? mousePosition.x + containerRect.left
      : mousePosition.y + containerRect.top;

    // Find insertion point by checking midpoints using ORIGINAL positions
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rect = item.getBoundingClientRect();

      // Check if this element is displaced by looking for our displacement data attribute
      const isDisplaced = item.hasAttribute("data-displaced");

      let originalStart = isHorizontal ? rect.left : rect.top;
      let originalSize = isHorizontal ? rect.width : rect.height;
      let displacementOffset = 0;

      if (isDisplaced) {
        // If the item is displaced, we need to calculate its original position
        // Parse the transform to get the displacement offset
        const transform = item.style.transform;
        const translateMatch = transform.match(/translate3d\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);

        if (translateMatch) {
          // For horizontal, use first value (X), for vertical use second (Y)
          displacementOffset = parseFloat(isHorizontal ? translateMatch[1] : translateMatch[2]);
          // Reverse the displacement to get original position
          originalStart = originalStart - displacementOffset;
        }
      }

      const originalMidpoint = originalStart + originalSize / 2;

      // DEBUG: Log converted coordinates for ghost trigger
      if (isHorizontal) {
        console.log("[GHOST-TRIGGER-CALC]", {
          mousePositionRaw: { x: mousePosition.x, y: mousePosition.y },
          containerRect: { left: containerRect.left, top: containerRect.top },
          convertedRelativePos: relativePos,
          itemIndex: i,
          itemRectLeft: rect.left,
          originalStart,
          originalMidpoint,
          isDisplaced,
          displacementOffset,
          comparison: `${relativePos} < ${originalMidpoint} = ${relativePos < originalMidpoint}`,
        });
      }

      if (relativePos < originalMidpoint) {
        // Check if this is an invalid position that should be skipped
        if (shouldSkipAdjacent && typeof draggedItemIndex === "number") {
          // For horizontal (lists): reject insertion at same position or immediately after
          // Position I and I+1 are invalid for a list at index I
          // For vertical (cards): keep original adjacent logic (±1)
          const isInvalidPosition = isHorizontal
            ? (i === draggedItemIndex || i === draggedItemIndex + 1)
            : Math.abs(i - draggedItemIndex) <= 1;
          if (isInvalidPosition) {
            return null; // Skip ghost for invalid positions
          }
        }
        return i;
      }
    }

    const endIndex = items.length;
    // Check if end position is invalid
    if (shouldSkipAdjacent && typeof draggedItemIndex === "number") {
      // For horizontal (lists): end position is invalid if it equals draggedItemIndex + 1
      // For vertical (cards): keep original adjacent logic
      const isInvalidEndPosition = isHorizontal
        ? endIndex === draggedItemIndex + 1
        : Math.abs(endIndex - draggedItemIndex) <= 1;
      if (isInvalidEndPosition) {
        return null; // Skip ghost for invalid end position
      }
    }

    return endIndex;
  }, [
    container,
    mousePosition?.x,
    mousePosition?.y,
    enabled,
    containerId,
    draggedId,
    isOver,
    canDrop,
    axis,
    draggedItemIndex,
    shouldSkipAdjacent,
    itemSelector,
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
    const dragItemType = isDragging && "item" in state ? state.item.type : null;

    // For vertical axis (cards), only trigger for card drags
    // For horizontal axis (lists), only trigger for list drags
    const isValidDragType = axis === "vertical"
      ? dragItemType === "card"
      : dragItemType === "list";

    if (!enabled || !isValidDragType) {
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
    axis,
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