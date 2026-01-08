"use client";

import * as React from "react";
import type { Coordinates } from "../core/types";

// ============================================================
// Types - Following the algorithm specification
// ============================================================

export type HoverTargetType = "LIST" | "LEFT_END" | "RIGHT_END";

export interface HoverTarget {
  type: HoverTargetType;
  index: number | null; // Only set when type === "LIST"
}

export type SlideDirection = "LEFT" | "RIGHT";

export interface DropInfo {
  valid: boolean;
  p: number | null; // Gap-based drop position (0..n)
}

export interface ListDragAnimationResult {
  /** Whether the ghost should be visible */
  ghostVisible: boolean;
  /** Where to render the ghost: list index, "LEFT_END", or "RIGHT_END" */
  ghostSlot: number | "LEFT_END" | "RIGHT_END" | null;
  /** The drop position (gap index 0..n) for reordering */
  dropPosition: number | null;
  /** Map of list indices to their slide direction */
  slides: Map<number, SlideDirection>;
  /** Current hover target for debugging */
  hoverTarget: HoverTarget | null;
}

export interface UseListDragAnimationOptions {
  /** Container element for the lists */
  container: HTMLElement | null;
  /** Current mouse/pointer position (container-relative coordinates) */
  mousePosition: Coordinates | null;
  /** Index of the currently dragged list (null if not dragging) */
  draggedIndex: number | undefined;
  /** Total number of lists */
  listCount: number;
  /** Whether the animation system is enabled */
  enabled: boolean;
  /** Selector for list elements */
  itemSelector?: string;
  /** Delay in ms before showing ghost (default: 400) */
  hoverDelay?: number;
}

// Empty result constant for reuse
const EMPTY_RESULT: ListDragAnimationResult = {
  ghostVisible: false,
  ghostSlot: null,
  dropPosition: null,
  slides: new Map(),
  hoverTarget: null,
};

// ============================================================
// Pure Calculation Functions (from algorithm spec)
// ============================================================

/**
 * 2.1 Determine Validity and Drop Position
 *
 * Given dragged index d and hover target, returns:
 * - valid: whether this is a valid drop target
 * - p: the drop position (gap index 0..n) if valid, null otherwise
 */
export function calculateDropInfo(
  d: number,
  hover: HoverTarget,
  n: number
): DropInfo {
  if (hover.type === "LIST") {
    const t = hover.index!;

    // Hovering over dragged list itself - invalid
    if (t === d) {
      return { valid: false, p: null };
    }

    // Valid drop: calculate gap position
    if (t < d) {
      return { valid: true, p: t };
    } else {
      return { valid: true, p: t + 1 };
    }
  }

  if (hover.type === "LEFT_END") {
    // Already at left end - invalid
    if (d === 0) {
      return { valid: false, p: null };
    }
    return { valid: true, p: 0 };
  }

  if (hover.type === "RIGHT_END") {
    // Already at right end - invalid
    if (d === n - 1) {
      return { valid: false, p: null };
    }
    return { valid: true, p: n };
  }

  return { valid: false, p: null };
}

/**
 * 2.2 Determine Which Lists Slide
 *
 * Returns a map of listIndex -> slide direction.
 * - When t < d: lists t..d-1 slide RIGHT
 * - When t > d: lists d+1..t slide LEFT
 * - Ends have no slides.
 */
export function calculateSlides(
  d: number,
  hover: HoverTarget
): Map<number, SlideDirection> {
  const slides = new Map<number, SlideDirection>();

  if (hover.type !== "LIST") {
    return slides; // No sliding at ends
  }

  const t = hover.index!;

  if (t === d) {
    return slides; // Invalid hover, no slides
  }

  if (t < d) {
    // Moving dragged list left: lists t..d-1 slide RIGHT
    for (let i = t; i <= d - 1; i++) {
      slides.set(i, "RIGHT");
    }
  } else {
    // t > d: moving dragged list right: lists d+1..t slide LEFT
    for (let i = d + 1; i <= t; i++) {
      slides.set(i, "LEFT");
    }
  }

  return slides;
}

/**
 * 2.3 Determine Ghost Slot
 *
 * Returns where to render the ghost, distinct from drop position p.
 */
export function calculateGhostSlot(
  hover: HoverTarget
): number | "LEFT_END" | "RIGHT_END" | null {
  if (hover.type === "LIST") {
    return hover.index!; // Ghost replaces hovered list's slot
  }

  if (hover.type === "LEFT_END") {
    return "LEFT_END";
  }

  if (hover.type === "RIGHT_END") {
    return "RIGHT_END";
  }

  return null;
}

/**
 * 2.4 Calculate New Index After Drop
 *
 * Converts gap-based drop position p to array index for insertion.
 */
export function calculateNewIndex(d: number, p: number): number {
  if (p <= d) {
    return p;
  } else {
    return p - 1;
  }
}

// ============================================================
// Hover Target Detection with Hysteresis
// ============================================================

/**
 * Detects which list or end zone the cursor is hovering over.
 * Uses hysteresis to prevent flickering at slot boundaries.
 *
 * @param mouseX - Container-relative X coordinate
 * @param listRects - Array of list element DOMRects
 * @param containerRect - Container element DOMRect
 * @param currentSlot - Previous slot index for hysteresis (null if none)
 * @param hysteresisPercent - Dead zone as percentage of slot width (default: 0.3 = 30%)
 */
export function detectHoverTargetWithHysteresis(
  mouseX: number,
  listRects: DOMRect[],
  containerRect: DOMRect,
  currentSlot: number | null,
  hysteresisPercent: number = 0.3
): HoverTarget | null {
  if (listRects.length === 0) {
    return null;
  }

  const relativeX = mouseX;

  // Check if cursor is before first list (LEFT_END)
  const firstListLeft = listRects[0].left - containerRect.left;
  if (relativeX < firstListLeft) {
    return { type: "LEFT_END", index: null };
  }

  // Check if cursor is after last list (RIGHT_END)
  const lastListRight = listRects[listRects.length - 1].right - containerRect.left;
  if (relativeX > lastListRight) {
    return { type: "RIGHT_END", index: null };
  }

  // If we have a current slot, apply hysteresis - require crossing threshold to change
  if (currentSlot !== null && currentSlot >= 0 && currentSlot < listRects.length) {
    const currentRect = listRects[currentSlot];
    const slotLeft = currentRect.left - containerRect.left;
    const slotRight = currentRect.right - containerRect.left;
    const slotWidth = slotRight - slotLeft;
    const deadZone = slotWidth * hysteresisPercent;

    // Stay in current slot if within expanded bounds (slot + dead zone on each side)
    if (relativeX >= (slotLeft - deadZone) && relativeX <= (slotRight + deadZone)) {
      return { type: "LIST", index: currentSlot };
    }
  }

  // Find new slot (no hysteresis needed for first detection or when outside dead zone)
  for (let i = 0; i < listRects.length; i++) {
    const rect = listRects[i];
    const slotLeft = rect.left - containerRect.left;
    const slotRight = rect.right - containerRect.left;

    if (relativeX >= slotLeft && relativeX <= slotRight) {
      return { type: "LIST", index: i };
    }
  }

  // Cursor is in a gap between lists - snap to nearest list
  for (let i = 0; i < listRects.length - 1; i++) {
    const currentRight = listRects[i].right - containerRect.left;
    const nextLeft = listRects[i + 1].left - containerRect.left;

    if (relativeX > currentRight && relativeX < nextLeft) {
      // In the gap - snap to the closer list
      const distToCurrentRight = relativeX - currentRight;
      const distToNextLeft = nextLeft - relativeX;

      if (distToCurrentRight <= distToNextLeft) {
        return { type: "LIST", index: i };
      } else {
        return { type: "LIST", index: i + 1 };
      }
    }
  }

  return null;
}

// ============================================================
// Main Hook
// ============================================================

export function useListDragAnimation({
  container,
  mousePosition,
  draggedIndex,
  listCount,
  enabled,
  itemSelector = '[data-slot="kanban-list"]',
  hoverDelay = 400,
}: UseListDragAnimationOptions): ListDragAnimationResult {
  // Track current slot for hysteresis (ref to avoid re-renders)
  const currentSlotRef = React.useRef<number | null>(null);

  // Timer for hover delay
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Stable result with delay applied
  const [stableResult, setStableResult] = React.useState<ListDragAnimationResult>(EMPTY_RESULT);

  // Get list element rects - ONLY recalculate when enabled changes (drag starts/ends)
  // NOT when mousePosition changes (would cause feedback loop with transforms)
  const originalRects = React.useMemo((): DOMRect[] => {
    if (!container || !enabled) return [];
    const elements = container.querySelectorAll(itemSelector);
    return Array.from(elements).map(el => el.getBoundingClientRect());
  }, [container, enabled, itemSelector]); // NO mousePosition dependency

  // Get container rect - also only when enabled changes
  const containerRect = React.useMemo((): DOMRect | null => {
    if (!container || !enabled) return null;
    return container.getBoundingClientRect();
  }, [container, enabled]); // NO mousePosition dependency

  // Calculate raw result (before delay)
  const rawResult = React.useMemo((): ListDragAnimationResult => {
    // Reset hysteresis when drag ends
    if (!enabled) {
      currentSlotRef.current = null;
      return EMPTY_RESULT;
    }

    // Early exit if missing data
    if (typeof draggedIndex !== "number" || !mousePosition || !containerRect) {
      return EMPTY_RESULT;
    }

    // Detect hover target with hysteresis
    const hoverTarget = detectHoverTargetWithHysteresis(
      mousePosition.x,
      originalRects,
      containerRect,
      currentSlotRef.current,
      0.3 // 30% dead zone
    );

    // Update current slot ref for next hysteresis check
    if (hoverTarget?.type === "LIST") {
      currentSlotRef.current = hoverTarget.index;
    } else if (hoverTarget?.type === "LEFT_END" || hoverTarget?.type === "RIGHT_END") {
      currentSlotRef.current = null; // Reset when at ends
    }

    if (!hoverTarget) {
      return { ...EMPTY_RESULT, hoverTarget: null };
    }

    // Calculate drop info
    const dropInfo = calculateDropInfo(draggedIndex, hoverTarget, listCount);

    if (!dropInfo.valid) {
      return { ...EMPTY_RESULT, hoverTarget };
    }

    // Calculate ghost slot and slides
    const ghostSlot = calculateGhostSlot(hoverTarget);
    const slides = calculateSlides(draggedIndex, hoverTarget);

    return {
      ghostVisible: true,
      ghostSlot,
      dropPosition: dropInfo.p,
      slides,
      hoverTarget,
    };
  }, [enabled, draggedIndex, mousePosition, containerRect, originalRects, listCount]);

  // Apply hover delay before updating stable result
  React.useEffect(() => {
    // Clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // If drag ended, immediately clear
    if (!enabled) {
      setStableResult(EMPTY_RESULT);
      return;
    }

    const wasVisible = stableResult.ghostVisible;
    const willBeVisible = rawResult.ghostVisible;

    if (willBeVisible && !wasVisible) {
      // Starting to hover - delay before showing
      timerRef.current = setTimeout(() => {
        setStableResult(rawResult);
      }, hoverDelay);
    } else if (!willBeVisible && wasVisible) {
      // Leaving valid hover - hide immediately
      setStableResult(rawResult);
    } else if (willBeVisible && wasVisible) {
      // Both visible - check if slot changed
      if (rawResult.ghostSlot !== stableResult.ghostSlot) {
        // Slot changed - hide immediately, then delay before showing new slot
        setStableResult(EMPTY_RESULT);
        timerRef.current = setTimeout(() => {
          setStableResult(rawResult);
        }, hoverDelay);
      }
      // Same slot - keep current stable result (no update needed)
    }
    // If both not visible, no action needed

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [rawResult, hoverDelay, enabled]); // Note: stableResult intentionally excluded to avoid loops

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return stableResult;
}

// ============================================================
// Animation Application Helper
// ============================================================

/**
 * Apply slide animations to list elements
 */
export function applyListSlides(
  container: HTMLElement,
  slides: Map<number, SlideDirection>,
  itemSelector: string,
  listWidth: number = 288,
  gap: number = 16,
  duration: number = 200
): void {
  const elements = container.querySelectorAll(itemSelector);
  const displacement = listWidth + gap;

  elements.forEach((element, index) => {
    const htmlElement = element as HTMLElement;
    const direction = slides.get(index);

    if (direction) {
      const transform = direction === "RIGHT"
        ? `translate3d(${displacement}px, 0, 0)`
        : `translate3d(-${displacement}px, 0, 0)`;

      htmlElement.style.transition = `transform ${duration}ms ease-out`;
      htmlElement.style.transform = transform;
      htmlElement.setAttribute("data-sliding", direction);
    } else {
      // Reset if not sliding
      if (htmlElement.getAttribute("data-sliding")) {
        htmlElement.style.transition = `transform ${duration}ms ease-out`;
        htmlElement.style.transform = "translate3d(0, 0, 0)";
        htmlElement.removeAttribute("data-sliding");
      }
    }
  });
}

/**
 * Reset all slide animations
 */
export function resetAllListSlides(
  container: HTMLElement,
  itemSelector: string,
  duration: number = 200
): void {
  const elements = container.querySelectorAll(itemSelector);

  elements.forEach((element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.style.transition = `transform ${duration}ms ease-out`;
    htmlElement.style.transform = "translate3d(0, 0, 0)";
    htmlElement.removeAttribute("data-sliding");
  });
}
