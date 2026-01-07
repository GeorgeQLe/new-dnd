// ============================================================
// Core Types
// ============================================================
export type {
  UniqueId,
  Coordinates,
  Rect,
  Transform,
  DragType,
  DropType,
  DragItem,
  DropTarget,
  InsertPosition,
  ListInsertPosition,
  GhostAxis,
  DragStatus,
  DragState,
  DragStateIdle,
  DragStatePending,
  DragStateDragging,
  DragStateEnding,
  DraggableRegistration,
  DroppableRegistration,
  DndCallbacks,
  CollisionDetector,
} from "./core/types";

// ============================================================
// Constants
// ============================================================
export {
  ACTIVATION_DELAY,
  ACTIVATION_DISTANCE,
  FLIP_ANIMATION_DURATION,
  FLIP_ANIMATION_EASING,
  DRAG_OVERLAY_Z_INDEX,
  DRAG_SCALE,
  CSS_VARS,
} from "./core/constants";

// ============================================================
// Utilities
// ============================================================
export {
  getRect,
  getCenter,
  distance,
  isPointInRect,
  closestCenter,
  droppablesContainingPoint,
  calculateInsertPosition,
  reorder,
  moveBetweenLists,
  getAnnouncement,
  clamp,
  rafThrottle,
} from "./core/utils";

// ============================================================
// Context & Provider
// ============================================================
export {
  DndProvider,
  useDndContext,
  useIsDragging,
  useActiveDragItem,
} from "./core/context";

// ============================================================
// Hooks
// ============================================================
export { useDraggable } from "./hooks/use-draggable";
export { useDroppable } from "./hooks/use-droppable";
export { useSortable } from "./hooks/use-sortable";
export { useDragOverlay, useDraggedElementRect } from "./hooks/use-drag-overlay";
export { useFLIPAnimation, useSingleFLIP } from "./hooks/use-flip-animation";
export { useHoverDetection, useDropPosition } from "./hooks/use-hover-detection";
export { usePreviewAnimation, useListPreviewAnimation } from "./hooks/use-preview-animation";
export { useListDisplacement, useBoardDisplacement, useListInBoard } from "./hooks/use-list-displacement";
export { useGhostTrigger } from "./hooks/use-ghost-trigger";
export {
  useListDragAnimation,
  applyListSlides,
  resetAllListSlides,
  calculateDropInfo,
  calculateSlides,
  calculateGhostSlot,
  calculateNewIndex,
  detectHoverTargetWithHysteresis,
  type HoverTarget,
  type HoverTargetType,
  type SlideDirection,
  type DropInfo,
  type ListDragAnimationResult,
  type UseListDragAnimationOptions,
} from "./hooks/use-list-drag-animation";

// ============================================================
// Sensors
// ============================================================
export {
  PointerSensor,
  createPointerSensor,
  type PointerSensorConfig,
} from "./sensors/pointer-sensor";

export {
  KeyboardSensor,
  createKeyboardSensor,
  calculateKeyboardMove,
  type KeyboardSensorConfig,
  type KeyboardDirection,
  type KeyboardMoveResult,
} from "./sensors/keyboard-sensor";
