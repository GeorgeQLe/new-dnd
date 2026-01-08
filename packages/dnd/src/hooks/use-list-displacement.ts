"use client";

import * as React from "react";
import { useHoverDetection } from "./use-hover-detection";
import { useListPreviewAnimation } from "./use-preview-animation";

// ============================================================
// Types
// ============================================================
interface ListDisplacementState {
  /** Whether this list should be displaced */
  isDisplaced: boolean;
  /** Direction of displacement */
  direction: "left" | "right";
  /** Whether to show the preview ghost */
  shouldShowPreview: boolean;
  /** Insert position for the preview */
  insertPosition: "before" | "after" | null;
}

interface UseListDisplacementOptions {
  /** Current list ID */
  listId: string;
  /** List index in the board */
  listIndex: number;
  /** Whether displacement is enabled */
  enabled?: boolean;
  /** List width for displacement calculations */
  listWidth?: number;
  /** Whether this list is disabled */
  disabled?: boolean;
}

interface DragState {
  isDragging: boolean;
  dragItemId?: string;
  dragItemType?: "card" | "list";
  dragItemIndex?: number;
}

// ============================================================
// Main Hook Implementation
// ============================================================
export function useListDisplacement({
  listId,
  listIndex,
  enabled = true,
  listWidth = 320, // Default list width
  disabled = false,
}: UseListDisplacementOptions) {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = React.useState<DragState>({
    isDragging: false,
  });

  // Only enable hover detection when a list is being dragged and it's not this list
  const hoverEnabled = dragState.isDragging && 
                      dragState.dragItemType === "list" && 
                      dragState.dragItemId !== listId &&
                      enabled &&
                      !disabled;

  // Hover detection with delay and threshold
  const { 
    shouldShowPreview, 
    mousePosition, 
    hoverHandlers 
  } = useHoverDetection({
    enabled: hoverEnabled,
    delay: 500,
    threshold: 10,
  });

  // Calculate displacement direction based on mouse position
  const [displacementData, setDisplacementData] = React.useState<ListDisplacementState>({
    isDisplaced: false,
    direction: "right",
    shouldShowPreview: false,
    insertPosition: null,
  });

  // Calculate displacement direction and preview position
  React.useEffect(() => {
    if (!shouldShowPreview || !mousePosition || !listRef.current || !hoverEnabled) {
      setDisplacementData({
        isDisplaced: false,
        direction: "right",
        shouldShowPreview: false,
        insertPosition: null,
      });
      return;
    }

    const rect = listRef.current.getBoundingClientRect();
    const isLeftHalf = mousePosition.x < rect.width / 2;
    const insertPosition = isLeftHalf ? "before" : "after";
    const direction = isLeftHalf ? "left" : "right";

    setDisplacementData({
      isDisplaced: shouldShowPreview,
      direction,
      shouldShowPreview,
      insertPosition,
    });
  }, [shouldShowPreview, mousePosition, hoverEnabled]);

  // Animation styles for this list
  const animationDirection = displacementData.direction;
  const { displacementStyles, previewStyles } = useListPreviewAnimation({
    shouldShow: displacementData.shouldShowPreview,
    direction: animationDirection,
    displacementDistance: listWidth,
  });

  // Helper function to update drag state from external components
  const updateDragState = React.useCallback((newDragState: DragState) => {
    setDragState(newDragState);
  }, []);

  return {
    /** Ref to attach to the list element */
    listRef,
    /** Current displacement state */
    displacementState: displacementData,
    /** Styles for the displaced list */
    displacementStyles,
    /** Styles for the preview ghost */
    previewStyles,
    /** Mouse event handlers for hover detection */
    hoverHandlers,
    /** Function to update drag state */
    updateDragState,
    /** Whether any animation is currently playing */
    isAnimating: shouldShowPreview,
  };
}

// ============================================================
// Board-level displacement coordination hook
// ============================================================
interface UseBoardDisplacementOptions {
  /** All lists in the board */
  lists: Array<{ id: string; index: number }>;
  /** Width of each list */
  listWidth?: number;
}

interface BoardDisplacementReturn {
  /** Current drag state to pass to individual lists */
  dragState: DragState;
  /** Function to update drag state when drag starts/changes */
  setDragState: (dragState: DragState) => void;
  /** Calculate displacement for a specific list */
  getListDisplacement: (targetListIndex: number, insertPosition: "before" | "after") => {
    listsToDisplace: number[];
    displacementDirection: "left" | "right";
  };
}

export function useBoardDisplacement({
  lists,
  listWidth = 320,
}: UseBoardDisplacementOptions): BoardDisplacementReturn {
  const [dragState, setDragState] = React.useState<DragState>({
    isDragging: false,
  });

  // Calculate which lists should be displaced and in which direction
  const getListDisplacement = React.useCallback((
    targetListIndex: number, 
    insertPosition: "before" | "after"
  ) => {
    if (!dragState.isDragging || dragState.dragItemType !== "list" || dragState.dragItemIndex === undefined) {
      return {
        listsToDisplace: [],
        displacementDirection: "right" as const,
      };
    }

    const draggedIndex = dragState.dragItemIndex;
    let listsToDisplace: number[] = [];
    let displacementDirection: "left" | "right" = "right";

    if (insertPosition === "before") {
      // When inserting before target, displace lists at and after target index
      if (draggedIndex < targetListIndex) {
        // Dragging from left to right
        listsToDisplace = lists
          .filter(list => list.index >= targetListIndex && list.index !== draggedIndex)
          .map(list => list.index);
        displacementDirection = "right";
      } else {
        // Dragging from right to left
        listsToDisplace = lists
          .filter(list => list.index >= targetListIndex && list.index < draggedIndex)
          .map(list => list.index);
        displacementDirection = "right";
      }
    } else {
      // When inserting after target, displace lists after target index
      if (draggedIndex < targetListIndex) {
        // Dragging from left to right
        listsToDisplace = lists
          .filter(list => list.index > targetListIndex && list.index !== draggedIndex)
          .map(list => list.index);
        displacementDirection = "right";
      } else {
        // Dragging from right to left
        listsToDisplace = lists
          .filter(list => list.index > targetListIndex && list.index < draggedIndex)
          .map(list => list.index);
        displacementDirection = "right";
      }
    }

    return {
      listsToDisplace,
      displacementDirection,
    };
  }, [dragState, lists]);

  return {
    dragState,
    setDragState,
    getListDisplacement,
  };
}

// ============================================================
// Simplified hook for individual lists in board context
// ============================================================
interface UseListInBoardOptions {
  listId: string;
  listIndex: number;
  dragState: DragState;
  boardDisplacementFn: (targetIndex: number, position: "before" | "after") => {
    listsToDisplace: number[];
    displacementDirection: "left" | "right";
  };
  listWidth?: number;
  disabled?: boolean;
}

export function useListInBoard({
  listId,
  listIndex,
  dragState,
  boardDisplacementFn,
  listWidth = 320,
  disabled = false,
}: UseListInBoardOptions) {
  const listRef = React.useRef<HTMLDivElement | null>(null);

  // Only enable hover detection when a list is being dragged and it's not this list
  const hoverEnabled = dragState.isDragging && 
                      dragState.dragItemType === "list" && 
                      dragState.dragItemId !== listId &&
                      !disabled;

  // Hover detection
  const { 
    shouldShowPreview, 
    mousePosition, 
    hoverHandlers 
  } = useHoverDetection({
    enabled: hoverEnabled,
    delay: 500,
    threshold: 10,
  });

  // Calculate displacement and preview data
  const [displacementData, setDisplacementData] = React.useState<{
    shouldDisplace: boolean;
    direction: "left" | "right";
    shouldShowPreview: boolean;
    insertPosition: "before" | "after" | null;
  }>({
    shouldDisplace: false,
    direction: "right",
    shouldShowPreview: false,
    insertPosition: null,
  });

  React.useEffect(() => {
    if (!shouldShowPreview || !mousePosition || !listRef.current || !hoverEnabled) {
      setDisplacementData({
        shouldDisplace: false,
        direction: "right",
        shouldShowPreview: false,
        insertPosition: null,
      });
      return;
    }

    const rect = listRef.current.getBoundingClientRect();
    const isLeftHalf = mousePosition.x < rect.width / 2;
    const insertPosition = isLeftHalf ? "before" : "after";

    // Check if this list should be displaced
    const { listsToDisplace, displacementDirection } = boardDisplacementFn(listIndex, insertPosition);
    const shouldDisplace = listsToDisplace.includes(listIndex);

    setDisplacementData({
      shouldDisplace,
      direction: displacementDirection,
      shouldShowPreview,
      insertPosition,
    });
  }, [shouldShowPreview, mousePosition, hoverEnabled, boardDisplacementFn, listIndex]);

  // Animation styles
  const { displacementStyles, previewStyles } = useListPreviewAnimation({
    shouldShow: displacementData.shouldDisplace,
    direction: displacementData.direction,
    displacementDistance: listWidth,
  });

  return {
    listRef,
    displacementData,
    displacementStyles,
    previewStyles,
    hoverHandlers,
    isAnimating: shouldShowPreview || displacementData.shouldDisplace,
  };
}