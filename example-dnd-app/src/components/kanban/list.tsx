"use client";

import * as React from "react";
import { useSortable, useDroppable, useDndContext } from "@/lib/dnd";
import {
  useCardDragAnimation,
  type CardGhost,
} from "@/lib/dnd/hooks/use-card-drag-animation";
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

  // List is also a drop target for cards and other lists
  const droppable = useDroppable({
    id: list.id,
    type: "list",
    accepts: ["card", "list"],
    disabled,
  });

  // Get mouse position from DnD context (container-relative)
  const mousePosition = React.useMemo(() => {
    if (state.status === "dragging" && cardsContainerRef.current && droppable.isOver) {
      const containerRect = cardsContainerRef.current.getBoundingClientRect();
      const currentPointer = state.current;

      if (currentPointer) {
        return {
          x: currentPointer.x - containerRect.left,
          y: currentPointer.y - containerRect.top,
        };
      }
    }
    return null;
  }, [state.status, state.status === "dragging" ? state.current : null, droppable.isOver]);

  // Get source list info from drag item
  const dragSourceInfo = React.useMemo(() => {
    if (currentDragItem?.type === "card") {
      const data = currentDragItem.data as { listId: string; index: number };
      return { listId: data.listId, index: data.index };
    }
    return null;
  }, [currentDragItem]);

  // New card drag animation hook - unified ghost and slide calculation
  const cardAnimation = useCardDragAnimation({
    container: cardsContainerRef.current,
    mousePosition,
    sourceListId: dragSourceInfo?.listId ?? null,
    draggedIndex: dragSourceInfo?.index,
    destListId: list.id,
    cardCount: list.cards.length,
    enabled: !disabled &&
             droppable.isOver &&
             droppable.canDrop &&
             currentDragItem?.type === "card",
    crossListSourceMode: "PLACEHOLDER",
    hoverDelay: 400,
  });

  // Extract ghost info from animation hook
  const ghost = cardAnimation.ghost;
  const isGhostVisible = cardAnimation.ghostVisible;

  // Note: Ghost zone is rendered inline based on ghost.p position.
  // No transform-based slides needed - the ghost zone naturally pushes
  // other cards down via CSS flex layout.

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
          {/* Ghost zone at start if ghost position is 0 */}
          {isGhostVisible && ghost && ghost.p === 0 && (
            <div
              data-slot="card-ghost-zone"
              className={cn(
                "flex items-center justify-center",
                "h-20 rounded-lg",
                "bg-blue-100 dark:bg-blue-950/30",
                "border-2 border-dashed border-blue-300 dark:border-blue-700",
                "animate-in fade-in-0 duration-200"
              )}
              style={{ pointerEvents: 'none' }}
            >
              <span className="text-blue-500 dark:text-blue-400 text-sm font-medium opacity-70">
                Place card here
              </span>
            </div>
          )}

          {list.cards.map((card, cardIndex) => {
            // Calculate actual card index (not affected by ghost since ghost is separate)
            const actualCardIndex = cardIndex;

            return (
              <React.Fragment key={card.id}>
                {/* Show drop indicator before first card if over but no ghost visible */}
                {droppable.isOver && cardIndex === 0 && !isGhostVisible && (
                  <DropIndicator
                    position="before"
                    orientation="vertical"
                    dragItem={currentDragItem}
                  />
                )}

                <KanbanCard
                  card={card}
                  index={actualCardIndex}
                  listId={list.id}
                  disabled={disabled}
                />

                {/* Ghost zone after this card if ghost.p matches */}
                {isGhostVisible && ghost && ghost.p === cardIndex + 1 && (
                  <div
                    data-slot="card-ghost-zone"
                    className={cn(
                      "flex items-center justify-center",
                      "h-20 rounded-lg",
                      "bg-blue-100 dark:bg-blue-950/30",
                      "border-2 border-dashed border-blue-300 dark:border-blue-700",
                      "animate-in fade-in-0 duration-200"
                    )}
                    style={{ pointerEvents: 'none' }}
                  >
                    <span className="text-blue-500 dark:text-blue-400 text-sm font-medium opacity-70">
                      Place card here
                    </span>
                  </div>
                )}

                {/* Show drop indicator after each card if it's the target (quick drop) */}
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

          {/* Empty state when not dragging and no ghost visible */}
          {list.cards.length === 0 && !droppable.isOver && !isGhostVisible && (
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
