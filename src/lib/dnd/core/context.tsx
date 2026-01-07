"use client";

import * as React from "react";
import type {
  DragState,
  DragItem,
  DropTarget,
  DraggableRegistration,
  DroppableRegistration,
  Coordinates,
  InsertPosition,
  DndCallbacks,
  UniqueId,
  Rect,
} from "./types";
import { closestCenter, getRect, calculateInsertPosition, calculateHorizontalInsertPosition } from "./utils";
import { ACTIVATION_DELAY } from "./constants";

// ============================================================
// Context Value Interface
// ============================================================
interface DndContextValue {
  // Current drag state
  state: DragState;

  // Registration
  registerDraggable: (registration: DraggableRegistration) => void;
  unregisterDraggable: (id: UniqueId) => void;
  registerDroppable: (registration: DroppableRegistration) => void;
  unregisterDroppable: (id: UniqueId) => void;

  // Actions
  startPending: (item: DragItem, origin: Coordinates) => void;
  startDrag: () => void;
  updateDrag: (coordinates: Coordinates) => void;
  setGhostIndicator: (visible: boolean, insertionIndex?: number | null) => void;
  setListGhostIndicator: (visible: boolean, insertionIndex?: number | null) => void;
  endDrag: () => void;
  cancelDrag: () => void;

  // Overlay
  setOverlayContent: (node: React.ReactNode) => void;
  overlayContent: React.ReactNode;

  // Utilities
  getDraggable: (id: UniqueId) => DraggableRegistration | undefined;
  getDroppable: (id: UniqueId) => DroppableRegistration | undefined;
  getDropTargetAtPoint: (point: Coordinates) => DropTarget | null;
  getInsertPosition: (
    point: Coordinates,
    target: DropTarget
  ) => InsertPosition | null;
}

// ============================================================
// Reducer Actions
// ============================================================
type DndAction =
  | {
      type: "START_PENDING";
      item: DragItem;
      origin: Coordinates;
      timeoutId: number;
    }
  | { type: "START_DRAG" }
  | {
      type: "UPDATE_DRAG";
      coordinates: Coordinates;
      over: DropTarget | null;
      insertPosition: InsertPosition | null;
    }
  | {
      type: "SET_GHOST_INDICATOR";
      visible: boolean;
      insertionIndex?: number | null;
    }
  | {
      type: "SET_LIST_GHOST_INDICATOR";
      visible: boolean;
      insertionIndex?: number | null;
    }
  | { type: "END_DRAG" }
  | { type: "CANCEL_DRAG" }
  | { type: "RESET" };

function dndReducer(state: DragState, action: DndAction): DragState {
  switch (action.type) {
    case "START_PENDING":
      return {
        status: "pending",
        item: action.item,
        origin: action.origin,
        activationTimeoutId: action.timeoutId,
      };

    case "START_DRAG":
      if (state.status !== "pending") return state;
      return {
        status: "dragging",
        item: state.item,
        origin: state.origin,
        current: state.origin,
        delta: { x: 0, y: 0 },
        over: null,
        insertPosition: null,
        ghostIndicatorVisible: false,
        ghostInsertionIndex: null,
        listGhostIndicatorVisible: false,
        listGhostInsertionIndex: null,
      };

    case "UPDATE_DRAG":
      if (state.status !== "dragging") return state;
      return {
        ...state,
        current: action.coordinates,
        delta: {
          x: action.coordinates.x - state.origin.x,
          y: action.coordinates.y - state.origin.y,
        },
        over: action.over,
        insertPosition: action.insertPosition,
      };

    case "SET_GHOST_INDICATOR":
      if (state.status !== "dragging") return state;
      return {
        ...state,
        ghostIndicatorVisible: action.visible,
        ghostInsertionIndex: action.visible ? action.insertionIndex ?? null : null,
      };

    case "SET_LIST_GHOST_INDICATOR":
      if (state.status !== "dragging") return state;
      return {
        ...state,
        listGhostIndicatorVisible: action.visible,
        listGhostInsertionIndex: action.visible ? action.insertionIndex ?? null : null,
      };

    case "END_DRAG":
      if (state.status !== "dragging") return state;
      return {
        status: "ending",
        item: state.item,
        target: state.over,
        insertPosition: state.insertPosition,
      };

    case "CANCEL_DRAG":
      if (state.status === "pending") {
        window.clearTimeout(state.activationTimeoutId);
      }
      return { status: "idle" };

    case "RESET":
      return { status: "idle" };

    default:
      return state;
  }
}

// ============================================================
// Provider Props
// ============================================================
interface DndProviderProps extends DndCallbacks {
  children: React.ReactNode;
}

// ============================================================
// Context Creation
// ============================================================
const DndContext = React.createContext<DndContextValue | null>(null);

export function DndProvider({
  children,
  onDragStart,
  onDragMove,
  onDragOver,
  onDragEnd,
  onDragCancel,
}: DndProviderProps) {
  const [state, dispatch] = React.useReducer(dndReducer, { status: "idle" });
  const [overlayContent, setOverlayContent] = React.useState<React.ReactNode>(null);

  // Registrations stored in refs to avoid re-renders
  const draggables = React.useRef<Map<UniqueId, DraggableRegistration>>(
    new Map()
  );
  const droppables = React.useRef<Map<UniqueId, DroppableRegistration>>(
    new Map()
  );

  // Cache for droppable rects
  const droppableRects = React.useRef<Map<UniqueId, Rect>>(new Map());

  // Track previous over target for change detection
  const previousOver = React.useRef<DropTarget | null>(null);

  // Track pending activation timeout for cleanup
  const pendingTimeoutRef = React.useRef<number | null>(null);

  // Track current state for callbacks to avoid stale closures
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ============================================================
  // Registration Functions
  // ============================================================
  const registerDraggable = React.useCallback(
    (reg: DraggableRegistration) => {
      draggables.current.set(reg.id, reg);
    },
    []
  );

  const unregisterDraggable = React.useCallback((id: UniqueId) => {
    draggables.current.delete(id);
  }, []);

  const registerDroppable = React.useCallback(
    (reg: DroppableRegistration) => {
      droppables.current.set(reg.id, reg);
      droppableRects.current.set(reg.id, getRect(reg.element));
    },
    []
  );

  const unregisterDroppable = React.useCallback((id: UniqueId) => {
    droppables.current.delete(id);
    droppableRects.current.delete(id);
  }, []);

  // ============================================================
  // Getter Functions
  // ============================================================
  const getDraggable = React.useCallback(
    (id: UniqueId) => draggables.current.get(id),
    []
  );

  const getDroppable = React.useCallback(
    (id: UniqueId) => droppables.current.get(id),
    []
  );

  const getDropTargetAtPoint = React.useCallback(
    (point: Coordinates): DropTarget | null => {
      // Use stateRef to avoid stale closure
      const currentState = stateRef.current;
      const activeItem =
        currentState.status === "dragging" || currentState.status === "pending"
          ? currentState.item
          : null;

      if (!activeItem) return null;

      // Pass cached rects to avoid layout thrashing
      const result = closestCenter(point, droppables.current, droppableRects.current, activeItem.type);
      
      return result;
    },
    []
  );

  const getInsertPosition = React.useCallback(
    (point: Coordinates, target: DropTarget): InsertPosition | null => {
      const droppable = droppables.current.get(target.id);
      if (!droppable) return null;

      // Use cached sortable items getter if available (avoids querySelectorAll on every drag move)
      const items = droppable.getSortableItems
        ? droppable.getSortableItems()
        : Array.from(droppable.element.querySelectorAll("[data-dnd-id]")) as HTMLElement[];

      // Use stateRef to avoid stale closure
      const currentState = stateRef.current;
      const activeItem = currentState.status === "dragging" ? currentState.item : null;

      let result: InsertPosition | null;
      // Use horizontal calculation for board (list reordering), vertical for lists (card reordering)
      if (target.type === "board") {
        result = calculateHorizontalInsertPosition(
          point,
          target.id,
          items,
          activeItem?.id ?? ""
        );
      } else {
        result = calculateInsertPosition(
          point,
          target.id,
          items,
          activeItem?.id ?? "",
          currentState
        );
      }

      return result;
    },
    []
  );

  // ============================================================
  // Action Functions
  // ============================================================
  const startPending = React.useCallback(
    (item: DragItem, origin: Coordinates) => {
      // Clear any existing pending timeout
      if (pendingTimeoutRef.current !== null) {
        window.clearTimeout(pendingTimeoutRef.current);
      }

      const timeoutId = window.setTimeout(() => {
        dispatch({ type: "START_DRAG" });
        onDragStart?.(item);
        pendingTimeoutRef.current = null;
      }, ACTIVATION_DELAY);

      pendingTimeoutRef.current = timeoutId;
      dispatch({ type: "START_PENDING", item, origin, timeoutId });
    },
    [onDragStart]
  );

  const startDrag = React.useCallback(() => {
    // Use stateRef to avoid stale closure when called from event handlers
    const currentState = stateRef.current;
    dispatch({ type: "START_DRAG" });
    if (currentState.status === "pending") {
      onDragStart?.(currentState.item);
    }
  }, [onDragStart]);

  const updateDrag = React.useCallback(
    (coordinates: Coordinates) => {
      // Use ref to get current state, avoiding stale closure during rapid updates
      const currentState = stateRef.current;
      if (currentState.status !== "dragging") return;

      const over = getDropTargetAtPoint(coordinates);
      const insertPosition = over
        ? getInsertPosition(coordinates, over)
        : null;

      dispatch({ type: "UPDATE_DRAG", coordinates, over, insertPosition });

      onDragMove?.(currentState.item, coordinates, over);

      // Check if over target changed
      const overChanged =
        over?.id !== previousOver.current?.id ||
        insertPosition?.index !== currentState.insertPosition?.index;

      if (overChanged) {
        onDragOver?.(currentState.item, over, insertPosition);
        previousOver.current = over;
      }
    },
    [getDropTargetAtPoint, getInsertPosition, onDragMove, onDragOver]
  );

  const setGhostIndicator = React.useCallback(
    (visible: boolean, insertionIndex?: number | null) => {
      dispatch({
        type: "SET_GHOST_INDICATOR",
        visible,
        insertionIndex: insertionIndex ?? null
      });
    },
    []
  );

  const setListGhostIndicator = React.useCallback(
    (visible: boolean, insertionIndex?: number | null) => {
      dispatch({
        type: "SET_LIST_GHOST_INDICATOR",
        visible,
        insertionIndex: insertionIndex ?? null
      });
    },
    []
  );

  const endDrag = React.useCallback(() => {
    // Use stateRef to avoid stale closure when called from event handlers
    const currentState = stateRef.current;
    if (currentState.status !== "dragging") return;

    dispatch({ type: "END_DRAG" });
    onDragEnd?.(currentState.item, currentState.over, currentState.insertPosition);

    // Reset after a frame to allow ending state to be read
    requestAnimationFrame(() => {
      dispatch({ type: "RESET" });
      setOverlayContent(null);
      previousOver.current = null;
    });
  }, [onDragEnd]);

  const cancelDrag = React.useCallback(() => {
    // Use stateRef to avoid stale closure when called from event handlers
    const currentState = stateRef.current;
    if (currentState.status !== "idle" && currentState.status !== "ending") {
      const item = currentState.item;
      dispatch({ type: "CANCEL_DRAG" });
      onDragCancel?.(item);
      setOverlayContent(null);
      previousOver.current = null;
    }
  }, [onDragCancel]);

  // ============================================================
  // Cleanup pending timeout on unmount
  // ============================================================
  React.useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current !== null) {
        window.clearTimeout(pendingTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================
  // Refresh droppable rects on scroll/resize
  // ============================================================
  React.useEffect(() => {
    const refreshRects = () => {
      droppables.current.forEach((droppable, id) => {
        droppableRects.current.set(id, getRect(droppable.element));
      });
    };

    // Throttle the refresh
    let rafId: number | null = null;
    const throttledRefresh = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          refreshRects();
          rafId = null;
        });
      }
    };

    window.addEventListener("scroll", throttledRefresh, { passive: true });
    window.addEventListener("resize", throttledRefresh, { passive: true });

    return () => {
      window.removeEventListener("scroll", throttledRefresh);
      window.removeEventListener("resize", throttledRefresh);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // ============================================================
  // Context Value
  // ============================================================
  const value = React.useMemo<DndContextValue>(
    () => ({
      state,
      registerDraggable,
      unregisterDraggable,
      registerDroppable,
      unregisterDroppable,
      startPending,
      startDrag,
      updateDrag,
      setGhostIndicator,
      setListGhostIndicator,
      endDrag,
      cancelDrag,
      setOverlayContent,
      overlayContent,
      getDraggable,
      getDroppable,
      getDropTargetAtPoint,
      getInsertPosition,
    }),
    [
      state,
      registerDraggable,
      unregisterDraggable,
      registerDroppable,
      unregisterDroppable,
      startPending,
      startDrag,
      updateDrag,
      setGhostIndicator,
      setListGhostIndicator,
      endDrag,
      cancelDrag,
      overlayContent,
      getDraggable,
      getDroppable,
      getDropTargetAtPoint,
      getInsertPosition,
    ]
  );

  return (
    <DndContext.Provider value={value}>
      {children}
      {/* Screen reader instructions for drag and drop */}
      <div
        id="dnd-instructions"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        Press Space or Enter to pick up. Use arrow keys to move. Press Space to drop, Escape to cancel.
      </div>
    </DndContext.Provider>
  );
}

// ============================================================
// Hook to access context
// ============================================================
export function useDndContext(): DndContextValue {
  const context = React.useContext(DndContext);
  if (!context) {
    throw new Error("useDndContext must be used within a DndProvider");
  }
  return context;
}

// ============================================================
// Hook to check if currently dragging (for conditional rendering)
// ============================================================
export function useIsDragging(): boolean {
  const { state } = useDndContext();
  return state.status === "dragging";
}

// ============================================================
// Hook to get the active drag item
// ============================================================
export function useActiveDragItem(): DragItem | null {
  const { state } = useDndContext();
  if (state.status === "dragging" || state.status === "pending") {
    return state.item;
  }
  return null;
}
