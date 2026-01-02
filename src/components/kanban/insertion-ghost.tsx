"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarIcon, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DragItem } from "@/lib/dnd";
import type { KanbanCardData } from "./card";
import type { KanbanListData } from "./list";

// ============================================================
// Types
// ============================================================
interface InsertionGhostProps {
  dragItem: DragItem;
  position: "before" | "after" | "inside";
  orientation?: "horizontal" | "vertical";
  className?: string;
}

// ============================================================
// Main InsertionGhost Component
// ============================================================
export function InsertionGhost({
  dragItem,
  position,
  orientation = "vertical",
  className,
}: InsertionGhostProps) {
  // Get the actual data from the drag item
  const cardData = dragItem.data as Partial<KanbanCardData>;
  const listData = dragItem.data as Partial<KanbanListData>;

  if (dragItem.type === "card") {
    return (
      <CardInsertionGhost
        cardData={cardData}
        position={position}
        orientation={orientation}
        className={className}
      />
    );
  }

  if (dragItem.type === "list") {
    return (
      <ListInsertionGhost
        listData={listData}
        position={position}
        orientation={orientation}
        className={className}
      />
    );
  }

  return null;
}

// ============================================================
// Card Insertion Ghost
// ============================================================
interface CardInsertionGhostProps {
  cardData: Partial<KanbanCardData>;
  position: "before" | "after" | "inside";
  orientation: "horizontal" | "vertical";
  className?: string;
}

function CardInsertionGhost({
  cardData,
  position,
  orientation,
  className,
}: CardInsertionGhostProps) {
  const baseStyles = cn(
    "relative transition-all duration-300 ease-out",
    "opacity-40", // Semi-transparent
    // Smooth entrance animations based on position
    position === "before" && "animate-in slide-in-from-top-2 fade-in-0 duration-300",
    position === "after" && "animate-in slide-in-from-bottom-2 fade-in-0 duration-300",
    position === "inside" && "animate-in zoom-in-95 fade-in-0 duration-300",
    // Positioning with smooth spacing transitions
    orientation === "vertical" && position === "before" && "mb-2",
    orientation === "vertical" && position === "after" && "mt-2",
    orientation === "horizontal" && position === "before" && "mr-2",
    orientation === "horizontal" && position === "after" && "ml-2",
    className
  );

  return (
    <div
      data-slot="card-insertion-ghost"
      data-position={position}
      data-orientation={orientation}
      className={baseStyles}
      style={{
        // Add subtle glow
        filter: 'drop-shadow(0 0 8px rgba(var(--primary), 0.3))',
        // Pulsing animation
        animation: 'insertion-pulse 2s ease-in-out infinite',
      }}
    >
      <Card className="border-primary/50 bg-card/80 shadow-lg">
        <CardContent className="p-3 space-y-2">
          {/* Header with title and star */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-tight">
              {cardData.name || "Card"}
            </p>
            {cardData.starred && (
              <StarIcon className="size-4 text-yellow-500 shrink-0 fill-yellow-500" />
            )}
          </div>

          {/* Description */}
          {cardData.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {cardData.description}
            </p>
          )}

          {/* Metadata badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {cardData.dueDate && (
              <Badge variant="outline" className="text-xs gap-1">
                <CalendarIcon className="size-3" />
                {format(new Date(cardData.dueDate), "MMM d")}
              </Badge>
            )}

            {cardData.progress != null && cardData.progress > 0 && (
              <Badge variant="secondary" className="text-xs">
                {cardData.progress}%
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Insertion indicator line */}
      <div
        className={cn(
          "absolute bg-primary/70 rounded-full animate-pulse",
          orientation === "horizontal" && "h-0.5 left-0 right-0",
          orientation === "vertical" && "w-0.5 top-0 bottom-0",
          position === "before" && orientation === "vertical" && "-top-2",
          position === "after" && orientation === "vertical" && "-bottom-2",
          position === "before" && orientation === "horizontal" && "-left-2",
          position === "after" && orientation === "horizontal" && "-right-2",
        )}
      />
    </div>
  );
}

// ============================================================
// List Insertion Ghost
// ============================================================
interface ListInsertionGhostProps {
  listData: Partial<KanbanListData>;
  position: "before" | "after" | "inside";
  orientation: "horizontal" | "vertical";
  className?: string;
}

function ListInsertionGhost({
  listData,
  position,
  orientation,
  className,
}: ListInsertionGhostProps) {
  const baseStyles = cn(
    "relative transition-all duration-300 ease-out",
    "opacity-40 min-w-70 w-80", // Semi-transparent with proper list width
    // Smooth entrance animations based on position  
    position === "before" && "animate-in slide-in-from-left-2 fade-in-0 duration-300",
    position === "after" && "animate-in slide-in-from-right-2 fade-in-0 duration-300",
    position === "inside" && "animate-in zoom-in-95 fade-in-0 duration-300",
    // Positioning with smooth spacing transitions
    orientation === "horizontal" && position === "before" && "mr-4",
    orientation === "horizontal" && position === "after" && "ml-4",
    className
  );

  return (
    <div
      data-slot="list-insertion-ghost"
      data-position={position}
      data-orientation={orientation}
      className={baseStyles}
      style={{
        // Add subtle glow
        filter: 'drop-shadow(0 0 12px rgba(var(--primary), 0.3))',
        // Pulsing animation
        animation: 'insertion-pulse 2s ease-in-out infinite',
      }}
    >
      <div className="bg-card/80 border border-primary/50 rounded-xl shadow-lg p-4 min-h-48">
        {/* List header */}
        <div className="mb-4 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {listData.name || "List"}
            </h3>
            <div className="text-xs text-muted-foreground">
              {listData.cards?.length || 0} cards
            </div>
          </div>
        </div>

        {/* Sample cards preview */}
        <div className="space-y-2">
          {(listData.cards || []).slice(0, 3).map((card, index) => (
            <div
              key={card.id || index}
              className="p-2 bg-background/60 border border-border/30 rounded-lg"
            >
              <div className="text-xs font-medium">{card.name}</div>
              {card.description && (
                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {card.description}
                </div>
              )}
            </div>
          )) || (
            // Placeholder cards when no data
            <>
              <div className="p-2 bg-background/60 border border-border/30 rounded-lg">
                <div className="h-3 bg-muted/50 rounded animate-pulse" />
              </div>
              <div className="p-2 bg-background/60 border border-border/30 rounded-lg">
                <div className="h-3 bg-muted/50 rounded animate-pulse w-3/4" />
              </div>
            </>
          )}

          {/* Show "..." if more cards */}
          {listData.cards && listData.cards.length > 3 && (
            <div className="text-center text-xs text-muted-foreground py-1">
              +{listData.cards.length - 3} more
            </div>
          )}
        </div>
      </div>

      {/* Insertion indicator line */}
      <div
        className={cn(
          "absolute bg-primary/70 rounded-full animate-pulse",
          orientation === "horizontal" && "w-0.5 top-0 bottom-0",
          position === "before" && orientation === "horizontal" && "-left-2",
          position === "after" && orientation === "horizontal" && "-right-2",
        )}
      />
    </div>
  );
}

// ============================================================
// CSS for custom animations (add to globals.css)
// ============================================================
/*
@keyframes insertion-pulse {
  0%, 100% { 
    opacity: 0.4;
    transform: scale(1);
  }
  50% { 
    opacity: 0.6;
    transform: scale(1.01);
  }
}
*/