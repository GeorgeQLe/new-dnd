"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================
interface ListGhostZoneProps {
  /** Width of the ghost zone (should match list width) */
  width?: number;
  /** Additional class names */
  className?: string;
}

// ============================================================
// ListGhostZone Component
// ============================================================
/**
 * A visual highlight zone that appears between lists during drag operations.
 * Shows where a dragged list will be inserted.
 *
 * Styling based on spec:
 * - Blue theme background (blue-100)
 * - Dashed border (blue-300)
 * - Full list width
 */
export function ListGhostZone({
  width = 288, // w-72 = 18rem = 288px
  className,
}: ListGhostZoneProps) {
  return (
    <div
      data-slot="list-ghost-zone"
      className={cn(
        // Layout
        "flex items-center justify-center flex-shrink-0",
        // Visual styling per spec
        "bg-blue-100 dark:bg-blue-950/30",
        "border-2 border-dashed border-blue-300 dark:border-blue-700",
        "rounded-lg",
        // Sizing
        "min-h-[200px]",
        // Animation
        "animate-in fade-in-0 duration-200",
        className
      )}
      style={{ width }}
    >
      {/* Optional drop hint text */}
      <div className="text-blue-500 dark:text-blue-400 text-sm font-medium opacity-70">
        Drop list here
      </div>
    </div>
  );
}

// ============================================================
// Export
// ============================================================
export default ListGhostZone;
