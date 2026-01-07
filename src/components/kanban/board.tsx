"use client";
import * as React from "react";
import {
  DndProvider,
  useFLIPAnimation,
  useDroppable,
  useDndContext,
  useListDragAnimation,
  calculateNewIndex,
  type DragItem,
  type DropTarget,
  type InsertPosition,
} from "@/lib/dnd";
import { cn } from "@/lib/utils";
import { KanbanList, type KanbanListData } from "./list";
import { DragOverlay } from "./drag-overlay";
import { ListGhostZone } from "./list-ghost-zone";

// ============================================================
// Shared State (for drop position between inner and outer components)
// ============================================================
const listDropPositionRef = { current: null as { position: number; draggedIndex: number } | null };

// ============================================================
// Types
// ============================================================
interface KanbanBoardProps {
  /** Lists with their cards */
  lists: KanbanListData[];
  /** Called when lists are reordered */
  onListReorder: (startIndex: number, endIndex: number) => void;
  /** Called when cards are reordered within a list */
  onCardReorder: (listId: string, startIndex: number, endIndex: number) => void;
  /** Called when a card is moved to a different list */
  onCardMove: (
    cardId: string,
    sourceListId: string,
    targetListId: string,
    targetIndex: number
  ) => void;
  /** Called when add card button is clicked */
  onAddCard?: (listId: string) => void;
  /** Called when add list button is clicked */
  onAddList?: () => void;
  /** Disable all drag operations */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}


// ============================================================
// Inner Component (needs DndProvider context)
// ============================================================
function KanbanBoardInner({
  lists,
  onListReorder,
  onCardReorder,
  onCardMove,
  onAddCard,
  onAddList,
  disabled = false,
  className,
}: KanbanBoardProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Get current drag state
  const { state } = useDndContext();
  const currentDragItem = React.useMemo(() =>
    state.status === "dragging" ? state.item : null,
    [state.status, state.status === "dragging" ? state.item.id : null]
  );

  // Single list edge case: disable list dragging when there's only one list
  // (there are no valid positions to move a single list to)
  const isListDragDisabled = lists.length <= 1;

  // Board itself is a droppable for list reordering
  // Use sortableSelector to only select list elements (not cards inside lists)
  const droppable = useDroppable({
    id: "board",
    type: "board",
    accepts: ["list"],
    disabled,
    sortableSelector: '[data-slot="kanban-list"]',
  });

  // Get dragged list index for same-position filtering
  const draggedListIndex = React.useMemo(() => {
    if (state.status === "dragging" && state.item.type === "list") {
      const itemData = state.item.data as { index: number };
      return itemData.index;
    }
    return undefined;
  }, [state.status, state.status === "dragging" ? state.item : null]);

  // Get mouse position from DnD context for list animation
  const mousePosition = React.useMemo(() => {
    if (state.status === "dragging" && containerRef.current && droppable.isOver && state.item.type === "list") {
      const containerRect = containerRef.current.getBoundingClientRect();
      const currentPointer = state.current;

      if (currentPointer) {
        // Return container-relative position
        return {
          x: currentPointer.x - containerRect.left,
          y: currentPointer.y - containerRect.top,
        };
      }
    }
    return null;
  }, [state.status, state.status === "dragging" ? state.current : null, droppable.isOver]);

  // List drag animation using the replacement-based ghost model
  const listAnimation = useListDragAnimation({
    container: containerRef.current,
    mousePosition,
    draggedIndex: draggedListIndex,
    listCount: lists.length,
    enabled: !disabled &&
             state.status === "dragging" &&
             state.item?.type === "list" &&
             droppable.isOver &&
             droppable.canDrop,
    itemSelector: '[data-slot="kanban-list"]',
    hoverDelay: 400, // 400ms delay before showing ghost/slides
  });

  // Extract animation state
  const isListGhostVisible = listAnimation.ghostVisible;
  const listGhostSlot = listAnimation.ghostSlot;
  const listDropPosition = listAnimation.dropPosition;

  // Update shared drop position ref for use in handleDragEnd
  // Only use ghost position when ghost is actually visible
  React.useEffect(() => {
    if (isListGhostVisible && listDropPosition !== null && draggedListIndex !== undefined) {
      // Ghost is visible with valid position - store it
      listDropPositionRef.current = { position: listDropPosition, draggedIndex: draggedListIndex };
    } else if (!isListGhostVisible) {
      // Ghost is not visible - clear the ref so we fall back to context position
      listDropPositionRef.current = null;
    }
  }, [listDropPosition, draggedListIndex, isListGhostVisible]);

  // FLIP animation for smooth reordering
  const { animate } = useFLIPAnimation({
    items: lists,
    containerRef,
  });

  // Animate after lists change
  React.useLayoutEffect(() => {
    animate();
  }, [lists, animate]);

  // Combine refs for the container
  const combinedRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      containerRef.current = element;
      droppable.setNodeRef(element);
    },
    [droppable]
  );

  return (
    <div
      ref={combinedRef}
      data-slot="kanban-board"
      className={cn(
        "flex gap-4 overflow-x-auto p-4",
        "min-h-[calc(100vh-200px)]",
        "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
        className
      )}
    >
      {/* Show ghost zone at LEFT_END (before first list) */}
      {isListGhostVisible && listGhostSlot === "LEFT_END" && (
        <ListGhostZone width={288} />
      )}

      {lists.map((list, index) => {
        // Check if this is the dragged list
        const isDraggedList =
          state.status === "dragging" &&
          state.item.type === "list" &&
          state.item.id === list.id;

        // Check if list drag is active (for disabling card interactions)
        const isListDragActive =
          state.status === "dragging" && state.item.type === "list";

        // Check if ghost should replace this list's slot
        const isGhostAtThisSlot = isListGhostVisible && listGhostSlot === index;

        return (
          <React.Fragment key={list.id}>
            {/* Show ghost zone at this list's slot (replacement model) */}
            {isGhostAtThisSlot && (
              <ListGhostZone width={288} />
            )}
            <KanbanList
              list={list}
              index={index}
              disabled={disabled || isListDragActive}
              listDragDisabled={isListDragDisabled}
              onAddCard={onAddCard}
              isDragging={isDraggedList}
            />
          </React.Fragment>
        );
      })}
      {/* Show ghost zone at RIGHT_END (after last list) */}
      {isListGhostVisible && listGhostSlot === "RIGHT_END" && (
        <ListGhostZone width={288} />
      )}

      {/* Add list button */}
      {onAddList && (
        <button
          type="button"
          onClick={onAddList}
          disabled={disabled}
          className={cn(
            "flex items-center justify-center gap-2",
            "w-72 shrink-0 rounded-lg border-2 border-dashed",
            "text-muted-foreground hover:text-foreground",
            "hover:border-primary/50 hover:bg-muted/30",
            "transition-colors duration-200",
            "h-12 min-h-12",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span>+</span>
          <span>Add list</span>
        </button>
      )}

      {/* Drag overlay */}
      <DragOverlay />
    </div>
  );
}

// ============================================================
// Type Guards for DragItem data validation
// ============================================================
function hasIndex(data: unknown): data is { index: number } {
  return (
    typeof data === "object" &&
    data !== null &&
    "index" in data &&
    typeof (data as { index: number }).index === "number"
  );
}

function hasListId(data: unknown): data is { listId: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "listId" in data &&
    typeof (data as { listId: string }).listId === "string"
  );
}

// ============================================================
// Main Component (wraps with DndProvider)
// ============================================================
export function KanbanBoard(props: KanbanBoardProps) {
  const handleDragStart = React.useCallback((item: DragItem) => {
    if (item.type === "list") {
    }
  }, []);

  const handleDragEnd = React.useCallback(
    (item: DragItem, target: DropTarget | null, position: InsertPosition | null) => {
      console.log("[DRAG-END] Called with:", {
        itemType: item.type,
        itemId: item.id,
        itemData: item.data,
        targetType: target?.type,
        targetId: target?.id,
        positionIndex: position?.index,
        positionListId: position?.listId,
        listDropPositionRef: listDropPositionRef.current,
      });

      // Handle list reorder operations
      if (item.type === "list") {
        if (!hasIndex(item.data)) {
          console.log("[DRAG-END] No index in item.data, returning");
          return;
        }

        const startIndex = item.data.index;
        console.log("[DRAG-END] List drag - startIndex:", startIndex);

        // Use our calculated drop position if available (from the animation system)
        if (listDropPositionRef.current) {
          const { position: dropPos, draggedIndex } = listDropPositionRef.current;
          const endIndex = calculateNewIndex(draggedIndex, dropPos);
          console.log("[DRAG-END] Using listDropPositionRef:", { dropPos, draggedIndex, endIndex });

          if (startIndex !== endIndex) {
            console.log("[DRAG-END] Calling onListReorder via ref:", startIndex, "->", endIndex);
            props.onListReorder(startIndex, endIndex);
          } else {
            console.log("[DRAG-END] startIndex === endIndex, no reorder");
          }
          listDropPositionRef.current = null; // Clear after use
          return;
        }

        // Fallback to context-provided position
        if (!position) {
          console.log("[DRAG-END] No position provided, returning");
          return;
        }

        const endIndex = position.index;
        console.log("[DRAG-END] Using context position - endIndex:", endIndex);

        if (target?.type === "list" && target?.id) {
          // List-to-list drop: convert target list ID to its board index
          const lists = props.lists;
          const targetListIndex = lists.findIndex(list => list.id === target.id);
          console.log("[DRAG-END] Target is list, targetListIndex:", targetListIndex);

          if (targetListIndex !== -1 && startIndex !== targetListIndex) {
            console.log("[DRAG-END] Calling onListReorder via target:", startIndex, "->", targetListIndex);
            props.onListReorder(startIndex, targetListIndex);
          } else {
            console.log("[DRAG-END] Same position or invalid target, no reorder");
          }
        } else if (startIndex !== endIndex) {
          console.log("[DRAG-END] Calling onListReorder via position:", startIndex, "->", endIndex);
          props.onListReorder(startIndex, endIndex);
        } else {
          console.log("[DRAG-END] startIndex === endIndex, no reorder");
        }
      } else if (item.type === "card") {
        // Handle card operations silently (no logs for cards)
        if (!position || !hasListId(item.data) || !hasIndex(item.data)) {
          return;
        }

        const sourceListId = item.data.listId;
        const startIndex = item.data.index;
        const targetListId = String(position.listId);
        const endIndex = position.index;

        if (sourceListId === targetListId) {
          if (startIndex !== endIndex) {
            props.onCardReorder(sourceListId, startIndex, endIndex);
          }
        } else {
          props.onCardMove(String(item.id), sourceListId, targetListId, endIndex);
        }
      }
    },
    [props]
  );

  const handleDragCancel = React.useCallback((_item: DragItem) => {
    // Optional: Handle drag cancel (e.g., analytics, haptic feedback)
  }, []);


  return (
    <DndProvider
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <KanbanBoardInner {...props} />
    </DndProvider>
  );
}

// ============================================================
// Skeleton for loading state
// ============================================================
export function KanbanBoardSkeleton({
  listCount = 3,
  className,
}: {
  listCount?: number;
  className?: string;
}) {
  return (
    <div
      data-slot="kanban-board-skeleton"
      className={cn(
        "flex gap-4 overflow-x-auto p-4",
        "min-h-[calc(100vh-200px)]",
        className
      )}
    >
      {Array.from({ length: listCount }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col w-72 shrink-0 rounded-lg bg-muted/50 border animate-pulse"
        >
          <div className="flex items-center justify-between p-3 border-b">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-4 bg-muted rounded w-6" />
          </div>
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}