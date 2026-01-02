"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DragItem } from "@/lib/dnd";

// ============================================================
// Types
// ============================================================
interface DropIndicatorProps {
  position: "before" | "after" | "empty";
  orientation?: "horizontal" | "vertical";
  dragItem?: DragItem | null;
  className?: string;
}

// ============================================================
// Simple Line Indicator Component
// ============================================================
export function DropIndicator({
  position,
  orientation = "vertical",
  dragItem,
  className,
}: DropIndicatorProps) {
  // Always use simple line indicators - ghost previews handled elsewhere
  return <SimpleDropIndicator position={position} orientation={orientation} className={className} />;
}

// ============================================================
// Simple fallback indicator (original behavior)
// ============================================================
function SimpleDropIndicator({
  position,
  orientation = "horizontal", 
  className,
}: Omit<DropIndicatorProps, "dragItem">) {
  if (position === "empty") {
    return (
      <div
        data-slot="drop-indicator"
        data-position={position}
        className={cn(
          "h-20 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5",
          "flex items-center justify-center text-sm text-muted-foreground",
          "animate-pulse",
          className
        )}
      >
        Drop here
      </div>
    );
  }

  return (
    <div
      data-slot="drop-indicator"
      data-position={position}
      data-orientation={orientation}
      className={cn(
        "rounded-full bg-primary animate-pulse",
        orientation === "horizontal" && "h-0.5 w-full",
        orientation === "vertical" && "w-0.5 h-full",
        position === "before" && orientation === "horizontal" && "-mt-1 mb-1",
        position === "after" && orientation === "horizontal" && "mt-1 -mb-1",
        position === "before" && orientation === "vertical" && "-ml-1 mr-1",
        position === "after" && orientation === "vertical" && "ml-1 -mr-1",
        className
      )}
    />
  );
}

// ============================================================
// Animated version with more visual feedback
// ============================================================
export function AnimatedDropIndicator({
  position,
  orientation = "horizontal",
  className,
}: DropIndicatorProps) {
  if (position === "empty") {
    return (
      <div
        data-slot="drop-indicator"
        data-position={position}
        className={cn(
          "h-20 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5",
          "flex items-center justify-center text-sm text-muted-foreground",
          "transition-all duration-200",
          className
        )}
        style={{
          animation: "drop-indicator-pulse 1.5s ease-in-out infinite",
        }}
      >
        Drop here
      </div>
    );
  }

  return (
    <div
      data-slot="drop-indicator"
      data-position={position}
      data-orientation={orientation}
      className={cn(
        "relative rounded-full bg-primary",
        orientation === "horizontal" && "h-0.5 w-full",
        orientation === "vertical" && "w-0.5 h-full",
        position === "before" && orientation === "horizontal" && "-mt-1 mb-1",
        position === "after" && orientation === "horizontal" && "mt-1 -mb-1",
        className
      )}
      style={{
        animation: "drop-indicator-glow 1s ease-in-out infinite",
      }}
    >
      {/* End circles for visual polish */}
      {orientation === "horizontal" && (
        <>
          <span className="absolute left-0 top-1/2 -translate-y-1/2 size-2 rounded-full bg-primary" />
          <span className="absolute right-0 top-1/2 -translate-y-1/2 size-2 rounded-full bg-primary" />
        </>
      )}
    </div>
  );
}
