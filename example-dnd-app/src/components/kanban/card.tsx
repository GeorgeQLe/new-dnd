"use client";

import * as React from "react";
import { useSortable, useDndContext } from "@/lib/dnd";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarIcon, CalendarIcon } from "lucide-react";
import { format } from "date-fns";

// ============================================================
// Types
// ============================================================
export interface KanbanCardData {
  id: string;
  listId: string;
  name: string;
  description: string | null;
  order: number;
  dueDate: Date | null;
  progress: number | null;
  starred: boolean | null;
}

interface KanbanCardProps {
  card: KanbanCardData;
  index: number;
  listId: string;
  disabled?: boolean;
  className?: string;
}

// ============================================================
// Component
// ============================================================
export function KanbanCard({
  card,
  index,
  listId,
  disabled = false,
  className,
}: KanbanCardProps) {
  const isGhostCard = card.id.startsWith('ghost-');
  const sortable = useSortable({
    id: card.id,
    type: "card",
    index,
    containerId: listId,
    data: { 
      cardName: card.name, 
      index,
      // Pass full card data for ghost rendering
      ...card,
      // Ensure listId is set correctly 
      listId
    },
    disabled: disabled || isGhostCard, // Disable sortable for ghost cards
  });



  return (
    <Card
      ref={isGhostCard ? undefined : sortable.setNodeRef}
      data-slot="kanban-card"
      data-id={card.id}
      data-dnd-id={card.id}
      data-dragging={isGhostCard ? false : sortable.isDragging}
      data-over={isGhostCard ? false : sortable.isOver}
      className={cn(
        !isGhostCard && "cursor-grab touch-none select-none",
        !isGhostCard && "transition-all duration-200 hover:shadow-md",
        !isGhostCard && "active:cursor-grabbing",
        // Keep dragged item visible (no opacity change)
        // sortable.isDragging && "opacity-30", // REMOVED: Show normal element while dragging
        // Subtle hover feedback
        !isGhostCard && sortable.isOver && "ring-1 ring-primary/30",
        disabled && "cursor-default opacity-50",
        className
      )}
      style={isGhostCard ? {} : {
        ...sortable.style,
        // Keep sortable styles including proper opacity and z-index for dragged cards
      }}
      {...(isGhostCard ? {} : sortable.attributes)}
      {...(isGhostCard ? {} : sortable.listeners)}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header with title and star */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{card.name}</p>
          {card.starred === true && (
            <StarIcon className="size-4 text-yellow-500 shrink-0 fill-yellow-500" />
          )}
        </div>

        {/* Description */}
        {card.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {card.description}
          </p>
        )}

        {/* Metadata badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {card.dueDate && (
            <Badge variant="outline" className="text-xs gap-1">
              <CalendarIcon className="size-3" />
              {format(new Date(card.dueDate), "MMM d")}
            </Badge>
          )}

          {card.progress != null && card.progress > 0 && (
            <Badge variant="secondary" className="text-xs">
              {card.progress}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Skeleton for loading state
// ============================================================
export function KanbanCardSkeleton({ className }: { className?: string }) {
  return (
    <Card
      data-slot="kanban-card-skeleton"
      className={cn("animate-pulse", className)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </CardContent>
    </Card>
  );
}
