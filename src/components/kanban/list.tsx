"use client";

import * as React from "react";
import { useSortable, useDroppable, useDndContext, useGhostTrigger } from "@/lib/dnd";
import { 
  useSmartDisplacement, 
  applyDisplacement,
  revertAllDisplacedElements 
} from "@/lib/dnd/hooks/use-smart-displacement";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanCard, type KanbanCardData } from "./card";
import { DropIndicator } from "./drop-indicator";

// ============================================================
// Types
// ============================================================
export interface KanbanListData {
  id: string;
  boardId: string;
  name: string;
  order: number;
  cards: KanbanCardData[];
}

interface KanbanListProps {
  list: KanbanListData;
  index: number;
  disabled?: boolean;
  className?: string;
  onAddCard?: (listId: string) => void;
  /** Whether this list is currently being dragged (for dimmed placeholder effect) */
  isDragging?: boolean;
  /** Whether list dragging is disabled (e.g., single list on board) */
  listDragDisabled?: boolean;
}

// ============================================================
// Component
// ============================================================
export function KanbanList({
  list,
  index,
  disabled = false,
  className,
  onAddCard,
  isDragging: isListBeingDragged = false,
  listDragDisabled = false,
}: KanbanListProps) {
  const cardsContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Get current drag state for passing to drop indicators
  const { state } = useDndContext();
  const currentDragItem = React.useMemo(() => 
    state.status === "dragging" ? state.item : null,
    [state.status, state.status === "dragging" ? state.item.id : null]
  );

  // List itself is sortable (for horizontal reordering)
  // Disable sortable if listDragDisabled is true (e.g., single list on board)
  const sortable = useSortable({
    id: list.id,
    type: "list",
    index,
    containerId: list.boardId,
    data: {
      boardId: list.boardId,
      listName: list.name,
      index,
      // Pass full list data for insertion ghost
      cards: list.cards,
      name: list.name
    },
    disabled: disabled || listDragDisabled,
  });

  // Get mouse position from DnD context first (doesn't depend on droppable)
  const mousePosition = React.useMemo(() => {
    if (state.status === "dragging" && cardsContainerRef.current) {
      const containerRect = cardsContainerRef.current.getBoundingClientRect();
      const currentPointer = state.current;
      
      if (currentPointer) {
        const relativePosition = {
          x: currentPointer.x - containerRect.left,
          y: currentPointer.y - containerRect.top,
        };
        
        
        return relativePosition;
      }
    }
    return null;
  }, [state.status, state.status === "dragging" ? state.current : null, list.id]);

  // Calculate smart displacement for cards within this list (minimal dependencies)
  const displacement = useSmartDisplacement({
    container: cardsContainerRef.current,
    mousePosition,
    itemType: "card",
    enabled: !disabled && 
             state.status === "dragging" && 
             state.item?.type === "card",
    itemSelector: "[data-dnd-id]",
    dragItem: currentDragItem,
    containerId: list.id,
  });

  // List is also a drop target for cards and other lists
  const droppable = useDroppable({
    id: list.id,
    type: "list",
    accepts: ["card", "list"],
    disabled,
  });

  // New ghost trigger logic - much simpler and more reliable
  const ghostTrigger = useGhostTrigger({
    enabled: !disabled && currentDragItem?.type === "card",
    container: cardsContainerRef.current,
    containerId: list.id,
    mousePosition,
    isOver: droppable.isOver,
    canDrop: droppable.canDrop,
    delay: 400,
  });

  // Create temporary ghost card when ghost trigger shows it should be visible
  const ghostCard = React.useMemo(() => {
    if (!ghostTrigger.shouldShowGhost || !currentDragItem || currentDragItem.type !== "card") {
      return null;
    }

    const dragSourceData = currentDragItem.data as { listId: string; index: number };
    const dragSourceListId = dragSourceData.listId;
    const draggedCardIndex = dragSourceData.index;
    const insertionIndex = ghostTrigger.ghostInsertionIndex;
    
    
    // Validate same-list moves based on empty space zones
    if (dragSourceListId === list.id && typeof insertionIndex === "number") {
      const totalCards = list.cards.length;
      
      // The empty space is at draggedCardIndex position
      // Reject any insertion that would be in or adjacent to the empty space
      
      // For dragging card at index N, reject insertions at:
      // - Index N (same position as empty space)  
      // - Index N+1 (immediately after empty space)
      const isInEmptySpaceZone = insertionIndex === draggedCardIndex || 
                                insertionIndex === draggedCardIndex + 1;
      
      if (isInEmptySpaceZone) {
        return null;
      }
    }

    // Create ghost card based on dragged card data with safe property access
    const data = currentDragItem.data as any;
    const ghostText = dragSourceListId === list.id ? "Move card here" : "Place card here";
    
    const ghostCard = {
      id: `ghost-${currentDragItem.id}`,
      listId: list.id,
      name: ghostText,
      description: data?.description || null,
      order: -1, // Temporary order
      dueDate: data?.dueDate || null,
      progress: data?.progress || null,
      starred: data?.starred || null,
    } as KanbanCardData;
    
    
    return ghostCard;
  }, [ghostTrigger.shouldShowGhost, ghostTrigger.ghostInsertionIndex, currentDragItem, list.id]);

  // Create cards array with ghost card inserted at ghost insertion position
  const cardsWithGhost = React.useMemo(() => {
    if (!ghostCard || typeof ghostTrigger.ghostInsertionIndex !== "number") {
      return list.cards;
    }

    const cards = [...list.cards];
    const insertionIndex = ghostTrigger.ghostInsertionIndex;
    
    // Insert ghost card at the calculated insertion index
    cards.splice(insertionIndex, 0, ghostCard);
    return cards;
  }, [list.cards, ghostCard, ghostTrigger.ghostInsertionIndex, list.id]);

  // Ghost visibility is based on the new ghost trigger hook
  const isGhostVisible = ghostTrigger.shouldShowGhost;


  // Apply subtle displacement animation for cards to make room for temp card or rearrangement
  React.useEffect(() => {
    const isDisplacementActive = state.status === "dragging" && isGhostVisible;
    
    if (displacement && isDisplacementActive && displacement.affectedItems.length > 0) {
      // Apply subtle displacement - cards move to make room (works for both cross-list and same-list)
      applyDisplacement(displacement, "card", 200, 0.3);
    } else {
      // Revert all displaced cards
      const container = cardsContainerRef.current;
      if (container) {
        revertAllDisplacedElements(container, 180);
      }
    }
  }, [displacement, state.status, isGhostVisible]);

  // Clean up any displaced elements when component unmounts or drag ends
  React.useEffect(() => {
    const container = cardsContainerRef.current;
    
    return () => {
      if (container) {
        revertAllDisplacedElements(container, 150);
      }
    };
  }, []);

  // Clean up displacement on drag end
  React.useEffect(() => {
    if (state.status !== "dragging" && cardsContainerRef.current) {
      revertAllDisplacedElements(cardsContainerRef.current, 180);
    }
  }, [state.status]);

  // Combine refs for both sortable and droppable
  const combinedRef = React.useCallback(
    (element: HTMLElement | null) => {
      sortable.setNodeRef(element);
      droppable.setNodeRef(element);
    },
    [sortable, droppable]
  );

  return (
    <div
      ref={combinedRef}
      data-slot="kanban-list"
      data-dnd-id={list.id}
      data-dragging={sortable.isDragging}
      data-over={droppable.isOver}
      className={cn(
        "flex flex-col w-72 shrink-0 rounded-lg bg-muted/50 border",
        "transition-all duration-200",
        // Dimmed placeholder effect when this list is being dragged (per spec: opacity ~0.3)
        isListBeingDragged && "opacity-30 pointer-events-none",
        droppable.isOver && droppable.canDrop && !isListBeingDragged && "ring-2 ring-primary/50 bg-muted/70",
        className
      )}
      style={{
        ...sortable.style,
        // Override sortable opacity when not the dragged list
        opacity: isListBeingDragged ? 0.3 : sortable.isDragging ? 1 : sortable.style?.opacity,
      }}
    >
      {/* List header - drag handle for list reordering */}
      <div
        data-slot="kanban-list-header"
        className={cn(
          "flex items-center justify-between p-3 border-b",
          !listDragDisabled && !disabled && "cursor-grab active:cursor-grabbing",
          (disabled || listDragDisabled) && "cursor-default"
        )}
        {...sortable.attributes}
        {...(listDragDisabled ? {} : sortable.listeners)}
      >
        <h3 className="font-semibold text-sm">{list.name}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {list.cards.length}
        </span>
      </div>

      {/* Cards container */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-250px)]">
        <div
          ref={cardsContainerRef}
          data-slot="kanban-list-content"
          className="flex flex-col gap-2 p-2 min-h-25"
        >
          {(isGhostVisible ? cardsWithGhost : list.cards).map((card, cardIndex) => {
            const isGhostCard = card.id.startsWith('ghost-');
            const actualCardIndex = isGhostVisible && isGhostCard 
              ? ghostTrigger.ghostInsertionIndex || cardIndex
              : cardIndex - (isGhostVisible && cardIndex > (ghostTrigger.ghostInsertionIndex || 0) ? 1 : 0);
            
            return (
              <React.Fragment key={card.id}>
                {/* Show drop indicator before first card if over */}
                {droppable.isOver && cardIndex === 0 && !isGhostVisible && (
                  <DropIndicator 
                    position="before" 
                    orientation="vertical"
                    dragItem={currentDragItem}
                  />
                )}

                <div
                  style={isGhostCard ? {
                    opacity: 0.6,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '2px dashed rgb(59, 130, 246)',
                    borderRadius: '8px',
                    pointerEvents: 'none'
                  } : {}}
                >
                  <KanbanCard
                    card={card}
                    index={actualCardIndex}
                    listId={list.id}
                    disabled={disabled}
                    className={cn(
                      isGhostCard && "pointer-events-none"
                    )}
                  />
                </div>

                {/* Show drop indicator after each card if it's the target */}
                {droppable.isOver && !isGhostVisible && (
                  <DropIndicator 
                    position="after" 
                    orientation="vertical"
                    dragItem={currentDragItem}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Empty list drop zone - only show if no ghost is visible */}
          {list.cards.length === 0 && droppable.isOver && droppable.canDrop && !isGhostVisible && (
            <DropIndicator 
              position="empty" 
              orientation="vertical"
              dragItem={currentDragItem}
            />
          )}

          {/* Empty state when not dragging */}
          {list.cards.length === 0 && !droppable.isOver && (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
              No cards
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add card button */}
      {onAddCard && (
        <div className="p-2 border-t">
          <button
            type="button"
            onClick={() => onAddCard(list.id)}
            className={cn(
              "w-full px-3 py-2 text-sm text-muted-foreground",
              "rounded-md hover:bg-muted transition-colors",
              "flex items-center justify-center gap-1"
            )}
            disabled={disabled}
          >
            <span>+</span>
            <span>Add card</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Skeleton for loading state
// ============================================================
export function KanbanListSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="kanban-list-skeleton"
      className={cn(
        "flex flex-col w-72 shrink-0 rounded-lg bg-muted/50 border animate-pulse",
        className
      )}
    >
      <div className="flex items-center justify-between p-3 border-b">
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-4 bg-muted rounded w-6" />
      </div>
      <div className="flex flex-col gap-2 p-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
