// ============================================================
// Identifiers
// ============================================================

/**
 * Unique identifier type used throughout the drag and drop system
 * Currently implemented as string for simplicity and compatibility
 */
export type UniqueId = string;

// ============================================================
// Geometry
// ============================================================

/**
 * 2D coordinates representing a point in space
 * x: horizontal position (positive = right)
 * y: vertical position (positive = down)
 */
export interface Coordinates {
  x: number;
  y: number;
}

/**
 * Rectangle bounds following standard browser DOMRect API pattern
 * Coordinates are measured from the top-left corner of the viewport
 * top: y-coordinate of the top edge
 * left: x-coordinate of the left edge  
 * right: x-coordinate of the right edge
 * bottom: y-coordinate of the bottom edge
 * width: horizontal size (right - left)
 * height: vertical size (bottom - top)
 */
export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * 2D transformation matrix values
 * x: horizontal translation offset
 * y: vertical translation offset
 * scaleX: horizontal scaling factor (1 = normal size)
 * scaleY: vertical scaling factor (1 = normal size)
 */
export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

// ============================================================
// Drag Types (specific to Kanban)
// ============================================================

/**
 * Types of draggable elements in the kanban system
 * "card": individual task/item cards within lists
 * "list": entire columns/lists that can be reordered
 */
export type DragType = "card" | "list";

/**
 * Types of drop zones where draggable elements can be dropped
 * "list": drop zone for cards within a specific list
 * "board": drop zone for lists on the board
 */
export type DropType = "list" | "board";

// ============================================================
// Drag Item (what is being dragged)
// ============================================================

/**
 * Represents an item currently being dragged
 * id: unique identifier for the dragged element
 * type: what kind of element is being dragged
 * data: contextual information based on drag type
 *   - for cards: which list they belong to and their position
 *   - for lists: their position on the board
 */
export interface DragItem<T extends DragType = DragType> {
  id: UniqueId;
  type: T;
  data: T extends "card"
    ? { listId: UniqueId; index: number }
    : { index: number };
}

// ============================================================
// Drop Target (where items can be dropped)
// ============================================================

/**
 * Represents a valid drop zone for dragged items
 * id: unique identifier for the drop target
 * type: what kind of drop zone this is
 * accepts: array of drag types that can be dropped here
 * rect: bounding rectangle for collision detection
 */
export interface DropTarget<T extends DropType = DropType> {
  id: UniqueId;
  type: T;
  accepts: DragType[];
  rect: Rect;
}

// ============================================================
// Insert Position (for sortable lists)
// ============================================================

/**
 * Specifies where in a sortable list an item should be inserted
 * listId: which list the item will be inserted into
 * index: target position in the list (0-based)
 * indicator: whether to insert before or after the target position
 */
export interface InsertPosition {
  listId: UniqueId;
  index: number;
  indicator: "before" | "after";
}

// ============================================================
// Drag State Machine
// ============================================================

/**
 * Possible states in the drag operation lifecycle
 * "idle": no drag operation in progress
 * "pending": drag detected but not yet active (waiting for delay/distance threshold)
 * "dragging": active drag operation in progress
 * "ending": drag operation completing (cleanup phase)
 */
export type DragStatus = "idle" | "pending" | "dragging" | "ending";

/**
 * Initial state when no drag operation is active
 */
export interface DragStateIdle {
  status: "idle";
}

/**
 * Intermediate state when drag is detected but not yet activated
 * item: the element that was initially selected for dragging
 * origin: starting coordinates of the drag operation
 * activationTimeoutId: timer ID for delayed activation
 */
export interface DragStatePending {
  status: "pending";
  item: DragItem;
  origin: Coordinates;
  activationTimeoutId: number;
}

/**
 * Active drag state with full tracking information
 * item: the element currently being dragged
 * origin: starting coordinates where drag began
 * current: current mouse/touch position
 * delta: offset from origin to current position
 * over: drop target currently under the cursor (if any)
 * insertPosition: where the item would be inserted if dropped (for sortable lists)
 * ghostIndicatorVisible: whether ghost indicator animation is active (after hover delay)
 * ghostInsertionIndex: precise insertion index from displacement system for ghost positioning
 */
export interface DragStateDragging {
  status: "dragging";
  item: DragItem;
  origin: Coordinates;
  current: Coordinates;
  delta: Coordinates;
  over: DropTarget | null;
  insertPosition: InsertPosition | null;
  ghostIndicatorVisible: boolean;
  ghostInsertionIndex: number | null;
}

/**
 * Final state when drag operation is completing
 * item: the element that was being dragged
 * target: final drop target (if any valid target)
 * insertPosition: final insertion position (for sortable lists)
 */
export interface DragStateEnding {
  status: "ending";
  item: DragItem;
  target: DropTarget | null;
  insertPosition: InsertPosition | null;
}

/**
 * Union type representing all possible drag states
 */
export type DragState =
  | DragStateIdle
  | DragStatePending
  | DragStateDragging
  | DragStateEnding;

// ============================================================
// Registered Elements - refer to DOM elements that have been registered with
//   the DnD system to participate in drag-and-drop operations.
// ============================================================

/**
 * Registration data for elements that can be dragged
 * id: unique identifier for the draggable element
 * type: what kind of element this is (card or list)
 * element: the DOM element that represents the draggable item
 * handleElement: optional specific element that acts as the drag handle (defaults to element)
 * data: arbitrary data associated with this draggable element
 * disabled: whether dragging is currently disabled for this element
 */
export interface DraggableRegistration {
  id: UniqueId;
  type: DragType;
  element: HTMLElement;
  handleElement?: HTMLElement;
  data: Record<string, unknown>;
  disabled: boolean;
}

/**
 * Registration data for elements that can accept dropped items
 * id: unique identifier for the drop zone
 * type: what kind of drop zone this is (list or board)
 * element: the DOM element that represents the drop area
 * accepts: array of drag types that this zone will accept
 * disabled: whether dropping is currently disabled for this zone
 * getSortableItems: optional performance optimization to cache sortable item queries
 */
export interface DroppableRegistration {
  id: UniqueId;
  type: DropType;
  element: HTMLElement;
  accepts: DragType[];
  disabled: boolean;
  /** Optional cached getter for sortable items to avoid querySelectorAll on every drag move */
  getSortableItems?: () => HTMLElement[];
}

// ============================================================
// Callbacks
// ============================================================

/**
 * Event callback functions for drag and drop operations
 * onDragStart: fired when a drag operation begins
 * onDragMove: fired continuously as the item is dragged (mouse/touch move)
 * onDragOver: fired when hovering over a valid drop target
 * onDragEnd: fired when a drag operation completes successfully
 * onDragCancel: fired when a drag operation is cancelled (ESC key, invalid drop, etc.)
 */
export interface DndCallbacks {
  onDragStart?: (item: DragItem) => void;
  onDragMove?: (
    item: DragItem,
    coordinates: Coordinates,
    over: DropTarget | null
  ) => void;
  onDragOver?: (
    item: DragItem,
    target: DropTarget | null,
    position: InsertPosition | null
  ) => void;
  onDragEnd?: (
    item: DragItem,
    target: DropTarget | null,
    position: InsertPosition | null
  ) => void;
  onDragCancel?: (item: DragItem) => void;
}

// ============================================================
// Collision Detection
// ============================================================

/**
 * Function type for detecting collisions between dragged items and drop targets
 * dragRect: bounding rectangle of the item being dragged
 * droppables: map of all registered droppable elements
 * Returns the best matching drop target or null if no valid target
 */
export type CollisionDetector = (
  dragRect: Rect,
  droppables: Map<UniqueId, DroppableRegistration>
) => DropTarget | null;
