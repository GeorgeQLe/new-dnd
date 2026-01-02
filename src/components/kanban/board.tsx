"use client";
import * as React from "react";
import {
  DndProvider,
  useFLIPAnimation,
  useDroppable,
  useDndContext,
  type DragItem,
  type DropTarget,
  type InsertPosition,
} from "@/lib/dnd";
import {
  useSmartDisplacement,
  applyDisplacement,
  revertAllDisplacedElements,
} from "@/lib/dnd/hooks/use-smart-displacement";
import { cn } from "@/lib/utils";
import { KanbanList, type KanbanListData } from "./list";
import { DragOverlay } from "./drag-overlay";

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

  // Board itself is a droppable for list reordering
  const droppable = useDroppable({
    id: "board",
    type: "board",
    accepts: ["list"],
    disabled,
  });

  // Get mouse position from DnD context for list displacement
  const mousePosition = React.useMemo(() => {
    if (state.status === "dragging" && containerRef.current && droppable.isOver && state.item.type === "list") {
      const containerRect = containerRef.current.getBoundingClientRect();
      const currentPointer = state.current;
      
      if (currentPointer) {
        const relativePosition = {
          x: currentPointer.x - containerRect.left,
          y: currentPointer.y - containerRect.top,
        };
        console.log(`[BOARD] DnD Pointer Position:`, { 
          absolute: currentPointer, 
          relative: relativePosition, 
          containerRect: { left: containerRect.left, top: containerRect.top }
        });
        return relativePosition;
      }
    }
    return null;
  }, [state.status, state.status === "dragging" ? state.current : null, droppable.isOver]);

  // Calculate smart displacement for lists
  const displacement = useSmartDisplacement({
    container: containerRef.current,
    mousePosition,
    itemType: "list",
    enabled: !disabled && 
             state.status === "dragging" && 
             state.item?.type === "list" &&
             droppable.isOver &&
             droppable.canDrop,
    itemSelector: "[data-dnd-id]",
  });

  // Track displacement visibility for lists (simplified - no ghost for lists yet)
  const isGhostVisible = React.useMemo(() => {
    return !disabled && 
           state.status === "dragging" && 
           state.item.type === "list" &&
           droppable.isOver &&
           droppable.canDrop &&
           !!displacement;
  }, [disabled, state.status, droppable.isOver, droppable.canDrop, displacement]);

  // Apply displacement animations to affected lists
  React.useEffect(() => {
    if (displacement && isGhostVisible) {
      applyDisplacement(displacement, "list", 280);
    } else if (!displacement && !isGhostVisible) {
      // Revert all displaced lists in the board
      const container = containerRef.current;
      if (container) {
        revertAllDisplacedElements(container, 220);
      }
    }
  }, [displacement, isGhostVisible]);

  // Clean up any displaced elements when component unmounts or drag ends
  React.useEffect(() => {
    const container = containerRef.current;
    
    return () => {
      if (container) {
        revertAllDisplacedElements(container, 180);
      }
    };
  }, []);

  // Clean up displacement on drag end
  React.useEffect(() => {
    if (state.status !== "dragging" && containerRef.current) {
      revertAllDisplacedElements(containerRef.current, 200);
    }
  }, [state.status]);

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
      {lists.map((list, index) => (
        <KanbanList
          key={list.id}
          list={list}
          index={index}
          disabled={disabled}
          onAddCard={onAddCard}
        />
      ))}

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
      // Only log list reorder operations
      if (item.type === "list") {
        if (!position || !hasIndex(item.data)) {
          return;
        }

        const startIndex = item.data.index;
        const endIndex = position.index;

        if (target?.type === "list" && target?.id) {
          // List-to-list drop: convert target list ID to its board index
          const lists = props.lists;
          const targetListIndex = lists.findIndex(list => list.id === target.id);
          
          
          if (targetListIndex !== -1 && startIndex !== targetListIndex) {
            props.onListReorder(startIndex, targetListIndex);
          }
        } else if (startIndex !== endIndex) {
          props.onListReorder(startIndex, endIndex);
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