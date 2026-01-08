"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================
interface DisplacementWrapperProps {
  children: React.ReactNode;
  isDisplaced: boolean;
  displacementDirection: "up" | "down" | "left" | "right";
  displacementDistance?: number;
  className?: string;
}

// ============================================================
// Displacement Wrapper Component
// ============================================================
export function DisplacementWrapper({
  children,
  isDisplaced,
  displacementDirection,
  displacementDistance = 8,
  className,
}: DisplacementWrapperProps) {
  const getDisplacementStyle = (): React.CSSProperties => {
    if (!isDisplaced) {
      return {
        transform: 'translate3d(0, 0, 0)',
        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }

    const transforms = {
      up: `translate3d(0, -${displacementDistance}px, 0)`,
      down: `translate3d(0, ${displacementDistance}px, 0)`,
      left: `translate3d(-${displacementDistance}px, 0, 0)`,
      right: `translate3d(${displacementDistance}px, 0, 0)`,
    };

    return {
      transform: transforms[displacementDirection],
      transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      // Visual hierarchy: displaced items are less prominent
      opacity: 0.85,
      // Add subtle blur and desaturation to emphasize movement
      filter: 'blur(0.5px) saturate(0.8)',
    };
  };

  return (
    <div
      data-slot="displacement-wrapper"
      data-displaced={isDisplaced}
      data-direction={displacementDirection}
      className={cn("relative", className)}
      style={getDisplacementStyle()}
    >
      {children}
      
      {/* Visual indicator that item is being displaced */}
      {isDisplaced && (
        <div 
          className="absolute inset-0 bg-muted/10 rounded-lg pointer-events-none transition-opacity duration-300"
          style={{ opacity: 0.3 }}
        />
      )}
    </div>
  );
}

// ============================================================
// Enhanced displacement hook with preview animation integration
// ============================================================
interface DisplacementState {
  isDisplaced: boolean;
  direction: "up" | "down" | "left" | "right";
  shouldShowPreview: boolean;
  previewPosition: "before" | "after" | null;
}

interface DisplacementOptions {
  /** Whether this element should participate in displacement */
  enabled?: boolean;
  /** Custom displacement distance */
  distance?: number;
}

export function useDisplacement(
  itemId: string,
  containerRef: React.RefObject<HTMLElement | null>,
  dragState: {
    isDragging: boolean;
    dragItemId?: string;
    insertPosition?: { targetId: string; position: "before" | "after" };
  },
  options: DisplacementOptions = {}
) {
  const { enabled = true, distance: customDistance } = options;
  
  const [displacement, setDisplacement] = React.useState<DisplacementState>({
    isDisplaced: false,
    direction: "down",
    shouldShowPreview: false,
    previewPosition: null,
  });

  // Calculate displacement based on drag state and target position
  const calculateDisplacement = React.useCallback((): DisplacementState => {
    if (!enabled || !dragState.isDragging || !dragState.insertPosition || !containerRef.current) {
      return {
        isDisplaced: false,
        direction: "down",
        shouldShowPreview: false,
        previewPosition: null,
      };
    }

    const { targetId, position } = dragState.insertPosition;
    const container = containerRef.current;
    
    // Get the layout direction of the container
    const isHorizontalLayout = container.classList.contains('flex-row') || 
                              getComputedStyle(container).flexDirection === 'row';

    // Find current and target elements
    const items = Array.from(container.children) as HTMLElement[];
    const currentIndex = items.findIndex(item => item.dataset.id === itemId);
    const targetIndex = items.findIndex(item => item.dataset.id === targetId);

    if (currentIndex === -1 || targetIndex === -1) {
      return {
        isDisplaced: false,
        direction: "down",
        shouldShowPreview: false,
        previewPosition: null,
      };
    }

    // Calculate displacement logic
    let shouldDisplace = false;
    let direction: "up" | "down" | "left" | "right" = "down";
    let shouldShowPreview = false;
    let previewPosition: "before" | "after" | null = null;

    if (isHorizontalLayout) {
      // Horizontal layout (lists)
      direction = "right";
      if (position === "before") {
        // Items at target index and after should move right
        shouldDisplace = currentIndex >= targetIndex;
        if (currentIndex === targetIndex) {
          shouldShowPreview = true;
          previewPosition = "before";
        }
      } else if (position === "after") {
        // Items after target index should move right
        shouldDisplace = currentIndex > targetIndex;
        if (currentIndex === targetIndex + 1) {
          shouldShowPreview = true;
          previewPosition = "before";
        }
      }
    } else {
      // Vertical layout (cards)
      direction = "down";
      if (position === "before") {
        // Items at target index and after should move down
        shouldDisplace = currentIndex >= targetIndex;
        if (currentIndex === targetIndex) {
          shouldShowPreview = true;
          previewPosition = "before";
        }
      } else if (position === "after") {
        // Items after target index should move down
        shouldDisplace = currentIndex > targetIndex;
        if (currentIndex === targetIndex + 1) {
          shouldShowPreview = true;
          previewPosition = "before";
        }
      }
    }

    return {
      isDisplaced: shouldDisplace,
      direction,
      shouldShowPreview,
      previewPosition,
    };
  }, [
    enabled,
    dragState.isDragging,
    dragState.insertPosition?.targetId,
    dragState.insertPosition?.position,
    itemId,
    containerRef,
  ]);

  // Update displacement state when dependencies change
  React.useEffect(() => {
    const newDisplacement = calculateDisplacement();
    
    // Only update state if something actually changed
    setDisplacement(prev => {
      if (
        prev.isDisplaced === newDisplacement.isDisplaced &&
        prev.direction === newDisplacement.direction &&
        prev.shouldShowPreview === newDisplacement.shouldShowPreview &&
        prev.previewPosition === newDisplacement.previewPosition
      ) {
        return prev;
      }
      return newDisplacement;
    });
  }, [calculateDisplacement]);

  return displacement;
}

// ============================================================
// Mouse position-based displacement hook
// ============================================================
interface MouseBasedDisplacementOptions extends DisplacementOptions {
  /** Current mouse position relative to element */
  mousePosition?: { x: number; y: number } | null;
  /** Element bounds for position calculations */
  elementBounds?: DOMRect | null;
}

export function useMouseBasedDisplacement(
  itemId: string,
  dragState: {
    isDragging: boolean;
    dragItemId?: string;
    dragItemType?: "card" | "list";
  },
  options: MouseBasedDisplacementOptions = {}
) {
  const { enabled = true, mousePosition, elementBounds } = options;
  
  const [displacement, setDisplacement] = React.useState<{
    isDisplaced: boolean;
    direction: "up" | "down" | "left" | "right";
    insertPosition: "before" | "after" | null;
  }>({
    isDisplaced: false,
    direction: "down",
    insertPosition: null,
  });

  React.useEffect(() => {
    if (!enabled || !dragState.isDragging || !mousePosition || !elementBounds) {
      setDisplacement({
        isDisplaced: false,
        direction: "down",
        insertPosition: null,
      });
      return;
    }

    // Determine insert position based on mouse position
    const isVerticalLayout = dragState.dragItemType === "card";
    let insertPosition: "before" | "after";
    let direction: "up" | "down" | "left" | "right";

    if (isVerticalLayout) {
      // For cards in vertical layout
      const isTopHalf = mousePosition.y < elementBounds.height / 2;
      insertPosition = isTopHalf ? "before" : "after";
      direction = "down";
    } else {
      // For lists in horizontal layout
      const isLeftHalf = mousePosition.x < elementBounds.width / 2;
      insertPosition = isLeftHalf ? "before" : "after";
      direction = "right";
    }

    setDisplacement({
      isDisplaced: true,
      direction,
      insertPosition,
    });
  }, [
    enabled,
    dragState.isDragging,
    dragState.dragItemType,
    mousePosition?.x,
    mousePosition?.y,
    elementBounds?.width,
    elementBounds?.height,
  ]);

  return displacement;
}

// ============================================================
// Preview Zone Wrapper (for drop targets)
// ============================================================
interface PreviewZoneProps {
  children: React.ReactNode;
  isActive: boolean;
  canDrop: boolean;
  dragItemType?: "card" | "list";
  className?: string;
}

export function PreviewZone({
  children,
  isActive,
  canDrop,
  dragItemType,
  className,
}: PreviewZoneProps) {
  const zoneStyles = cn(
    "relative transition-all duration-200 ease-out",
    // Active states with drop allowed
    isActive && canDrop && [
      "ring-2 ring-primary/50 ring-offset-2",
      "bg-primary/5",
      "scale-[1.01]",
      "shadow-lg shadow-primary/10",
    ],
    // Active states with drop not allowed
    isActive && !canDrop && [
      "ring-2 ring-destructive/50 ring-offset-2", 
      "bg-destructive/5",
    ],
    // Subtle hover states when not dragging
    !isActive && "hover:bg-accent/5 hover:scale-[1.005]",
    className
  );

  return (
    <div
      data-slot="preview-zone"
      data-active={isActive}
      data-can-drop={canDrop}
      data-drag-item-type={dragItemType}
      className={zoneStyles}
    >
      {/* Background overlay for emphasis */}
      {isActive && canDrop && (
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-primary/10 rounded-lg pointer-events-none" />
      )}
      
      {/* Error state overlay */}
      {isActive && !canDrop && (
        <div className="absolute inset-0 bg-linear-to-br from-destructive/5 to-destructive/10 rounded-lg pointer-events-none" />
      )}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Visual indicators */}
      {isActive && canDrop && (
        <div className="absolute top-2 right-2 pointer-events-none">
          <div className="size-2 bg-primary rounded-full animate-bounce" />
        </div>
      )}
      
      {isActive && !canDrop && (
        <div className="absolute top-2 right-2 pointer-events-none">
          <div className="size-2 bg-destructive rounded-full animate-ping" />
        </div>
      )}
    </div>
  );
}