"use client";

import * as React from "react";
import type { Coordinates, DragItem } from "../core/types";

// ============================================================
// Types
// ============================================================
interface ContainerDimensions {
  width: number;
  height: number;
  top: number;
  left: number;
}

interface ItemPosition {
  index: number;
  element: HTMLElement;
  rect: DOMRect;
}

interface DisplacementCalculation {
  direction: "up" | "down" | "left" | "right";
  affectedItems: ItemPosition[];
  insertionPoint: Coordinates;
  insertionIndex: number;
}

interface SmartDisplacementOptions {
  /** Container element for the items */
  container: HTMLElement | null;
  /** Current mouse position relative to container */
  mousePosition: Coordinates | null;
  /** Type of items being displaced */
  itemType: "card" | "list";
  /** Whether displacement is enabled */
  enabled?: boolean;
  /** Custom item selector (default: [data-id]) */
  itemSelector?: string;
  /** Current drag item (for same-list filtering) */
  dragItem?: DragItem | null;
  /** Current container ID (for same-list filtering) */
  containerId?: string;
}

// ============================================================
// Smart Direction Calculation Functions
// ============================================================

/**
 * Calculate optimal displacement direction for cards (vertical)
 */
function calculateCardDisplacementDirection(
  insertionIndex: number,
  items: ItemPosition[],
  container: ContainerDimensions,
  insertionY: number
): "up" | "down" {
  const itemsAbove = insertionIndex;
  const itemsBelow = items.length - insertionIndex;
  const availableSpaceBelow = container.height - (insertionY - container.top);
  const availableSpaceAbove = insertionY - container.top;

  // Calculate space needed for displacement
  const averageItemHeight = items.length > 0 
    ? items.reduce((sum, item) => sum + item.rect.height, 0) / items.length 
    : 120;

  const spaceNeededBelow = itemsBelow * (averageItemHeight + 8); // 8px gap
  const spaceNeededAbove = itemsAbove * (averageItemHeight + 8);

  // Smart direction logic:
  // 1. If more items below and space available, shift down
  // 2. If more space above than below, shift up
  // 3. If dropping near bottom, shift up
  if (itemsBelow <= itemsAbove || 
      availableSpaceBelow < spaceNeededBelow ||
      insertionIndex > items.length * 0.7) {
    return "up";
  }
  
  return "down";
}

/**
 * Calculate optimal displacement direction for lists (horizontal)
 */
function calculateListDisplacementDirection(
  insertionIndex: number,
  items: ItemPosition[],
  container: ContainerDimensions,
  insertionX: number
): "left" | "right" {
  const itemsLeft = insertionIndex;
  const itemsRight = items.length - insertionIndex;
  const availableSpaceRight = container.width - (insertionX - container.left);
  const availableSpaceLeft = insertionX - container.left;

  // Calculate space needed for displacement
  const averageItemWidth = items.length > 0
    ? items.reduce((sum, item) => sum + item.rect.width, 0) / items.length
    : 288; // Default list width

  const spaceNeededRight = itemsRight * (averageItemWidth + 16); // 16px gap
  const spaceNeededLeft = itemsLeft * (averageItemWidth + 16);

  // Smart direction logic:
  // 1. If more items to right and space available, shift right
  // 2. If more space to left than right, shift left  
  // 3. If dropping near right edge, shift left
  if (itemsRight <= itemsLeft ||
      availableSpaceRight < spaceNeededRight ||
      insertionIndex > items.length * 0.7) {
    return "left";
  }

  return "right";
}

/**
 * Calculate precise insertion point based on mouse position
 */
function calculateInsertionPoint(
  mousePosition: Coordinates,
  items: ItemPosition[],
  itemType: "card" | "list"
): { index: number; position: Coordinates } {
  if (items.length === 0) {
    return { index: 0, position: mousePosition };
  }

  const isVertical = itemType === "card";
  
  // Find the insertion index based on mouse position
  let insertionIndex = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const center = isVertical 
      ? item.rect.top + item.rect.height / 2
      : item.rect.left + item.rect.width / 2;
    
    const mousePos = isVertical ? mousePosition.y : mousePosition.x;
    
    if (mousePos < center) {
      insertionIndex = i;
      break;
    }
    insertionIndex = i + 1;
  }

  // Calculate exact insertion position
  let insertionPosition: Coordinates;
  
  if (insertionIndex === 0) {
    // Insert at beginning
    const firstItem = items[0];
    insertionPosition = isVertical
      ? { x: mousePosition.x, y: firstItem.rect.top - 4 }
      : { x: firstItem.rect.left - 8, y: mousePosition.y };
  } else if (insertionIndex >= items.length) {
    // Insert at end
    const lastItem = items[items.length - 1];
    insertionPosition = isVertical
      ? { x: mousePosition.x, y: lastItem.rect.bottom + 4 }
      : { x: lastItem.rect.right + 8, y: mousePosition.y };
  } else {
    // Insert between items
    const prevItem = items[insertionIndex - 1];
    const nextItem = items[insertionIndex];
    
    insertionPosition = isVertical
      ? { x: mousePosition.x, y: (prevItem.rect.bottom + nextItem.rect.top) / 2 }
      : { x: (prevItem.rect.right + nextItem.rect.left) / 2, y: mousePosition.y };
  }

  return { index: insertionIndex, position: insertionPosition };
}

// ============================================================
// Main Hook Implementation
// ============================================================
export function useSmartDisplacement({
  container,
  mousePosition,
  itemType,
  enabled = true,
  itemSelector = "[data-id]",
  dragItem = null,
  containerId = undefined,
}: SmartDisplacementOptions): DisplacementCalculation | null {
  const [calculation, setCalculation] = React.useState<DisplacementCalculation | null>(null);

  // Memoize container dimensions
  const containerDimensions = React.useMemo((): ContainerDimensions | null => {
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
    };
  }, [container]);

  // Get all items in the container
  const items = React.useMemo((): ItemPosition[] => {
    if (!container) return [];
    
    const elements = container.querySelectorAll(itemSelector);
    return Array.from(elements).map((element, index) => ({
      index,
      element: element as HTMLElement,
      rect: element.getBoundingClientRect(),
    }));
  }, [container, itemSelector]);

  // Calculate displacement
  React.useEffect(() => {
    if (!enabled || !mousePosition || !containerDimensions || items.length === 0 || !container) {
      setCalculation(null);
      return;
    }

    // Calculate insertion point
    const { index: insertionIndex, position: insertionPoint } = calculateInsertionPoint(
      mousePosition,
      items,
      itemType
    );

    // Calculate displacement direction and affected items based on available space
    let direction: "up" | "down" | "left" | "right";
    let affectedItems: ItemPosition[];
    
    if (itemType === "card") {
      // Check available space and scroll context for smart displacement
      const cardHeight = 132; // Approximate card height + gap
      const containerHeight = containerDimensions.height;
      const lastCardBottom = items.length > 0 ? items[items.length - 1].rect.bottom : containerDimensions.top;
      const availableSpaceBelow = (containerDimensions.top + containerHeight) - lastCardBottom;
      const isScrollableList = container && container.scrollHeight > container.clientHeight;
      
      // Determine if we're inserting at or near the end
      const isInsertingAtEnd = insertionIndex >= items.length - 1;
      
      if (isInsertingAtEnd && isScrollableList) {
        // If inserting at end of scrollable list, move cards above up
        direction = "up";
        affectedItems = items.slice(0, insertionIndex);
      } else if (availableSpaceBelow >= cardHeight) {
        // If there's room below, move cards after insertion point down
        direction = "down";
        affectedItems = items.slice(insertionIndex);
      } else {
        // If no room below, move cards above up
        direction = "up";
        affectedItems = items.slice(0, insertionIndex);
      }
      
      
      // Filter out adjacent cards for same-list moves to avoid invalid drop positions
      if (dragItem && containerId && dragItem.type === "card" && itemType === "card") {
        const dragSourceData = dragItem.data as { listId: string; index: number };
        const isDragWithinSameList = dragSourceData.listId === containerId;
        
        if (isDragWithinSameList) {
          const draggedCardIndex = dragSourceData.index;
          
          // Filter out cards that are immediately adjacent to the dragged card
          affectedItems = affectedItems.filter(item => {
            const cardIndex = item.index;
            
            // Don't displace the dragged card itself or its immediate neighbors
            // since dropping between them would result in no actual movement
            const isAdjacentCard = Math.abs(cardIndex - draggedCardIndex) <= 1;
            const isDraggedCard = cardIndex === draggedCardIndex;
            
            return !isAdjacentCard && !isDraggedCard;
          });
        }
      }
      
      // If no affected items, don't displace anything
      if (affectedItems.length === 0) {
        affectedItems = [];
      }
    } else {
      // List displacement logic remains the same
      direction = calculateListDisplacementDirection(insertionIndex, items, containerDimensions, insertionPoint.x);
      affectedItems = direction === "left"
        ? items.slice(0, insertionIndex)
        : items.slice(insertionIndex);
    }

    setCalculation({
      direction,
      affectedItems,
      insertionPoint,
      insertionIndex,
    });
  }, [
    enabled,
    mousePosition,
    containerDimensions,
    items,
    itemType,
  ]);

  return calculation;
}

// ============================================================
// Utility Functions for Animation
// ============================================================

/**
 * Apply displacement transforms to affected items
 */
export function applyDisplacement(
  calculation: DisplacementCalculation,
  itemType: "card" | "list",
  duration = 250,
  displacementMultiplier = 1.0
): void {
  const { direction, affectedItems } = calculation;
  
  
  // Calculate displacement distance based on item type with multiplier for subtle animations
  const baseDistance = itemType === "card" ? 132 : 320; // Card height + gap or list width + gap
  const distance = baseDistance * displacementMultiplier;
  
  const transform = (() => {
    switch (direction) {
      case "up": return `translate3d(0, -${distance}px, 0)`;
      case "down": return `translate3d(0, ${distance}px, 0)`;
      case "left": return `translate3d(-${distance}px, 0, 0)`;
      case "right": return `translate3d(${distance}px, 0, 0)`;
      default: return `translate3d(0, ${distance}px, 0)`; // fallback to down
    }
  })();

  // Apply transforms with coordinated timing
  affectedItems.forEach((item, index) => {
    const element = item.element;
    
    // Stagger animation slightly for smoother feel
    const staggerDelay = index * 15; // 15ms stagger between items
    
    // Apply immediate transform with hardware acceleration and higher specificity
    element.style.willChange = "transform, opacity";
    element.style.backfaceVisibility = "hidden";
    
    // Store original transform to avoid conflicts
    const originalTransform = element.style.transform;
    element.setAttribute("data-original-transform", originalTransform);
    
    // Apply displacement transform with !important-like behavior via direct style setting
    element.style.setProperty("transform", transform, "important");
    element.style.transition = `transform ${duration}ms ease-out ${staggerDelay}ms, opacity ${duration * 0.6}ms ease-out ${staggerDelay}ms`;
    
    // Temporarily disable off-screen fading to prevent wrong cards becoming transparent
    const isOffScreen = false; // TODO: Fix off-screen detection logic later
    
    // Ensure all displaced elements maintain full opacity during displacement
    setTimeout(() => {
      element.style.setProperty("opacity", "1", "important");
    }, staggerDelay);
    
    // Mark element as displaced for cleanup
    element.setAttribute("data-displaced", "true");
    
  });
}

/**
 * Revert displacement transforms with enhanced smooth animations
 */
export function revertDisplacement(
  affectedItems: ItemPosition[],
  duration = 200
): void {
  affectedItems.forEach((item, index) => {
    const element = item.element;
    
    // Only revert if element was actually displaced
    if (element.getAttribute("data-displaced") === "true") {
      // Stagger reversion for smooth feel (reverse order)
      const staggerDelay = (affectedItems.length - index - 1) * 10; 
      
      // Reset transform with smooth transition
      setTimeout(() => {
        // Restore original transform if it existed
        const originalTransform = element.getAttribute("data-original-transform");
        const resetTransform = originalTransform || "translate3d(0, 0, 0)";
        
        element.style.setProperty("transform", resetTransform, "important");
        element.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out, filter ${duration}ms ease-out`;
        element.style.setProperty("opacity", "1", "important");
        element.style.pointerEvents = "auto";
        element.style.filter = "none";
        element.style.willChange = "auto";
        
        // Clean up displacement marker after animation
        setTimeout(() => {
          element.removeAttribute("data-displaced");
          element.removeAttribute("data-original-transform");
          // Remove important flags to allow normal CSS to take over
          element.style.removeProperty("transform");
          element.style.removeProperty("opacity");
        }, duration);
      }, staggerDelay);
    }
  });
}

/**
 * Enhanced revert function for container-based cleanup
 */
export function revertAllDisplacedElements(
  container: HTMLElement,
  duration = 200
): void {
  const displacedElements = container.querySelectorAll('[data-displaced="true"]');
  
  
  Array.from(displacedElements).forEach((element, index) => {
    const htmlElement = element as HTMLElement;
    
    // Reverse stagger order for smooth reversion
    const staggerDelay = (displacedElements.length - index - 1) * 12;
    
    setTimeout(() => {
      htmlElement.style.transform = "translate3d(0, 0, 0)";
      htmlElement.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out, filter ${duration}ms ease-out`;
      htmlElement.style.opacity = "1";
      htmlElement.style.pointerEvents = "auto";
      htmlElement.style.filter = "none";
      htmlElement.style.willChange = "auto";
      
      // Clean up after animation completes
      setTimeout(() => {
        htmlElement.removeAttribute("data-displaced");
      }, duration);
    }, staggerDelay);
  });
}

// ============================================================
// Container Mouse Position Tracking Hook
// ============================================================
interface UseContainerMouseTrackingOptions {
  /** Container element to track mouse position within */
  container: HTMLElement | null;
  /** Whether tracking is enabled */
  enabled?: boolean;
}

export function useContainerMouseTracking({
  container,
  enabled = true,
}: UseContainerMouseTrackingOptions) {
  const [mousePosition, setMousePosition] = React.useState<Coordinates | null>(null);

  React.useEffect(() => {
    if (!enabled || !container) {
      setMousePosition(null);
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      setMousePosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    const handleMouseLeave = () => {
      setMousePosition(null);
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [container, enabled]);

  return mousePosition;
}

// ============================================================
// Note: Ghost rendering is now handled by temporary card injection
// in list components rather than DOM-based positioning
// ============================================================