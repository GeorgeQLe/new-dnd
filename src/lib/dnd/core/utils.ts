import type {
  Coordinates,
  Rect,
  UniqueId,
  DroppableRegistration,
  DropTarget,
  DragItem,
  InsertPosition,
  DragType,
  DragState,
} from "./types";

/**
 * Get the bounding client rect of an element as a Rect object
 */
export function getRect(element: HTMLElement): Rect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Calculate the center point of a rect
 */
export function getCenter(rect: Rect): Coordinates {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Calculate euclidean distance between two points
 */
export function distance(a: Coordinates, b: Coordinates): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Check if a point is inside a rect
 */
export function isPointInRect(point: Coordinates, rect: Rect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

/**
 * Find the closest droppable by center distance
 * Returns the drop target or null if none found
 * Uses cached rects to avoid layout thrashing during drag
 */
export function closestCenter(
  point: Coordinates,
  droppables: Map<UniqueId, DroppableRegistration>,
  cachedRects: Map<UniqueId, Rect>,
  activeType: DragType
): DropTarget | null {
  let closestTarget: DropTarget | null = null;
  let closestDistance = Infinity;

  droppables.forEach((droppable, id) => {
    // Skip disabled droppables or those that don't accept this type
    if (droppable.disabled || !droppable.accepts.includes(activeType)) {
      return;
    }

    // Skip sortable wrapper droppables - these are internal to useSortable
    // and should not be matched as drop targets. Only the actual container
    // droppables (lists for cards, board for lists) should be matched.
    if (String(id).startsWith("sortable-")) {
      return;
    }

    // Use cached rect to avoid layout thrashing
    const rect = cachedRects.get(id);
    if (!rect) return;

    const center = getCenter(rect);
    const dist = distance(point, center);

    if (dist < closestDistance) {
      closestDistance = dist;
      closestTarget = {
        id,
        type: droppable.type,
        accepts: droppable.accepts,
        rect,
      };
    }
  });

  return closestTarget;
}

/**
 * Find droppables that contain the point
 */
export function droppablesContainingPoint(
  point: Coordinates,
  droppables: Map<UniqueId, DroppableRegistration>,
  activeType: DragType
): DropTarget[] {
  const results: DropTarget[] = [];

  droppables.forEach((droppable, id) => {
    if (droppable.disabled || !droppable.accepts.includes(activeType)) {
      return;
    }

    // Skip sortable wrapper droppables
    if (String(id).startsWith("sortable-")) {
      return;
    }

    const rect = getRect(droppable.element);
    if (isPointInRect(point, rect)) {
      results.push({
        id,
        type: droppable.type,
        accepts: droppable.accepts,
        rect,
      });
    }
  });

  return results;
}

/**
 * Calculate insert position within a sortable container
 * Determines where an item should be inserted based on pointer position
 * Uses ghost indicator positioning when available, otherwise falls back to midpoint logic
 */
export function calculateInsertPosition(
  point: Coordinates,
  containerId: UniqueId,
  items: HTMLElement[],
  draggedId: UniqueId,
  dragState: DragState
): InsertPosition | null {
  if (items.length === 0) {
    return {
      listId: containerId,
      index: 0,
      indicator: "before",
    };
  }

  // Filter out the currently dragged item
  const sortableItems = items.filter(
    (item) => item.getAttribute("data-dnd-id") !== draggedId
  );

  if (sortableItems.length === 0) {
    return {
      listId: containerId,
      index: 0,
      indicator: "before",
    };
  }

  // If ghost indicator is visible (deliberate drop after hover delay), use ghost insertion index
  if (dragState.status === "dragging" && dragState.ghostIndicatorVisible && typeof dragState.ghostInsertionIndex === "number") {
    const clampedIndex = Math.max(0, Math.min(dragState.ghostInsertionIndex, sortableItems.length));
    return {
      listId: containerId,
      index: clampedIndex,
      indicator: clampedIndex === 0 ? "before" : "after",
    };
  }

  // Default behavior: Find insertion point by checking vertical midpoints (quick drop)
  for (let i = 0; i < sortableItems.length; i++) {
    const rect = getRect(sortableItems[i]);
    const midpoint = rect.top + rect.height / 2;

    if (point.y < midpoint) {
      return {
        listId: containerId,
        index: i,
        indicator: "before",
      };
    }
  }

  // If we're past all items, insert at the end
  return {
    listId: containerId,
    index: sortableItems.length,
    indicator: "after",
  };
}

/**
 * Calculate insert position within a horizontal sortable container (like lists on a board)
 * Determines where an item should be inserted based on pointer position
 */
export function calculateHorizontalInsertPosition(
  point: Coordinates,
  containerId: UniqueId,
  items: HTMLElement[],
  draggedId: UniqueId
): InsertPosition | null {
  if (items.length === 0) {
    return {
      listId: containerId,
      index: 0,
      indicator: "before",
    };
  }

  // Filter out the currently dragged item
  const sortableItems = items.filter(
    (item) => item.getAttribute("data-dnd-id") !== draggedId
  );

  if (sortableItems.length === 0) {
    return {
      listId: containerId,
      index: 0,
      indicator: "before",
    };
  }

  // Find insertion point by checking horizontal midpoints
  for(let i = 0; i < sortableItems.length; i++) {
    const rect = getRect(sortableItems[i]);
    const midpoint = rect.left + rect.width / 2;

    if (point.x < midpoint) {
      return {
        listId: containerId,
        index: i,
        indicator: "before",
      };
    }
  }

  // If we're past all items, insert at the end
  return {
    listId: containerId,
    index: sortableItems.length,
    indicator: "after",
  };
}

/**
 * Reorder an array by moving an item from one index to another
 */
export function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

/**
 * Move an item between two lists
 */
export function moveBetweenLists<T>(
  source: T[],
  destination: T[],
  sourceIndex: number,
  destinationIndex: number
): { source: T[]; destination: T[] } {
  const sourceClone = Array.from(source);
  const destClone = Array.from(destination);
  const [removed] = sourceClone.splice(sourceIndex, 1);
  destClone.splice(destinationIndex, 0, removed);

  return {
    source: sourceClone,
    destination: destClone,
  };
}

/**
 * Generate a unique announcements for screen readers
 */
export function getAnnouncement(
  item: DragItem,
  event: "start" | "move" | "end" | "cancel",
  position?: InsertPosition
): string {
  const itemType = item.type === "card" ? "Card" : "List";

  switch (event) {
    case "start":
      return `Picked up ${itemType}. Use arrow keys to move, Space to drop, Escape to cancel.`;
    case "move":
      if (position) {
        return `${itemType} is now at position ${position.index + 1}.`;
      }
      return `${itemType} is being moved.`;
    case "end":
      if (position) {
        return `${itemType} dropped at position ${position.index + 1}.`;
      }
      return `${itemType} dropped.`;
    case "cancel":
      return `${itemType} drop cancelled.`;
    default:
      return "";
  }
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Create a throttled version of a function using requestAnimationFrame
 */
export function rafThrottle<Args extends unknown[]>(
  fn: (...args: Args) => void
): ((...args: Args) => void) & { cancel: () => void } {
  let rafId: number | null = null;
  let lastArgs: Args | null = null;

  const throttled = ((...args: Args) => {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          fn(...lastArgs);
        }
        rafId = null;
      });
    }
  }) as ((...args: Args) => void) & { cancel: () => void };

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  return throttled;
}
