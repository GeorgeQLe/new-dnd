"use client";

import * as React from "react";
import { useDragOverlay, useDndContext, DRAG_OVERLAY_Z_INDEX, DRAG_SCALE } from "@/lib/dnd";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================
interface DragOverlayProps {
  className?: string;
  children?: React.ReactNode;
}

// ============================================================
// Component
// ============================================================
export function DragOverlay({ className, children }: DragOverlayProps) {
  const { isDragging, activeItem, position, Portal } = useDragOverlay();
  
  if (!isDragging || !activeItem || !position) {
    return null;
  }

  // Render appropriate overlay content based on drag item type
  if (activeItem.type === "card") {
    const data = activeItem.data as any;
    return (
      <Portal>
        <div
          className={cn("fixed pointer-events-none", className)}
          style={{
            left: position.x,
            top: position.y,
            zIndex: DRAG_OVERLAY_Z_INDEX,
            transform: `translate(-50%, -50%) scale(${DRAG_SCALE})`,
          }}
        >
          <CardOverlayContent
            name={data?.name || data?.cardName || "Moving card..."}
            description={data?.description}
            starred={data?.starred}
          />
        </div>
      </Portal>
    );
  }

  if (activeItem.type === "list") {
    const data = activeItem.data as any;
    return (
      <Portal>
        <div
          className={cn("fixed pointer-events-none", className)}
          style={{
            left: position.x,
            top: position.y,
            zIndex: DRAG_OVERLAY_Z_INDEX,
            transform: `translate(-50%, -50%) scale(${DRAG_SCALE})`,
          }}
        >
          <ListOverlayContent
            name={data?.name || data?.listName || "Moving list..."}
            cardCount={data?.cards?.length || 0}
          />
        </div>
      </Portal>
    );
  }

  return children || null;
}

// ============================================================
// Custom overlay content for cards
// ============================================================
interface CardOverlayProps {
  name: string;
  description?: string | null;
  starred?: boolean;
  className?: string;
}

export function CardOverlayContent({
  name,
  description,
  starred,
  className,
}: CardOverlayProps) {
  return (
    <div
      data-slot="card-overlay-content"
      className={cn(
        "bg-card border rounded-lg p-3 shadow-xl",
        "ring-2 ring-primary",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{name}</p>
        {starred && (
          <span className="text-yellow-500">★</span>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          {description}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Custom overlay content for lists
// ============================================================
interface ListOverlayProps {
  name: string;
  cardCount: number;
  className?: string;
}

export function ListOverlayContent({
  name,
  cardCount,
  className,
}: ListOverlayProps) {
  return (
    <div
      data-slot="list-overlay-content"
      className={cn(
        "bg-muted/90 border rounded-lg p-3 shadow-xl min-w-70",
        "ring-2 ring-primary",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{name}</span>
        <span className="text-xs text-muted-foreground">
          {cardCount} cards
        </span>
      </div>
    </div>
  );
}
