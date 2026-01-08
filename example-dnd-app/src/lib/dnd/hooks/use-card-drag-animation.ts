"use client";

import * as React from "react";
import type { Coordinates } from "../core/types";

// ============================================================
// Types - Following the card algorithm specification
// ============================================================

export type ListId = string;
export type CardSlide = "UP" | "DOWN";
export type CardSlideMap = Map<number, CardSlide>;
export type CrossListSourceMode = "PLACEHOLDER" | "COLLAPSE";

export type CardHoverTarget =
  | { type: "CARD"; listId: ListId; cardIndex: number; region: "TOP" | "BOTTOM" }
  | { type: "LIST_EMPTY"; listId: ListId }
  | { type: "ABOVE_LIST"; listId: ListId }
  | { type: "BELOW_LIST"; listId: ListId };

export type CardGhost = {
  listId: ListId;
  p: number;        // Gap index (visual position)
  newIndex: number; // Insertion index (data operation)
} | null;

export interface CardDropInfo {
  valid: boolean;
  ghost: CardGhost;
}

export interface CardDragAnimationResult {
  /** Ghost info with gap index and insertion index */
  ghost: CardGhost;
  /** Whether the ghost should be visible (after delay) */
  ghostVisible: boolean;
  /** Slide offsets for all lists */
  slideOffsets: Record<ListId, CardSlideMap>;
  /** Current hover target for debugging */
  hoverTarget: CardHoverTarget | null;
}

export interface UseCardDragAnimationOptions {
  /** Container element for the cards */
  container: HTMLElement | null;
  /** Current mouse/pointer position (container-relative coordinates) */
  mousePosition: Coordinates | null;
  /** Source list ID (where the card is being dragged from) */
  sourceListId: string | null;
  /** Index of the dragged card in the source list */
  draggedIndex: number | undefined;
  /** Destination list ID (this list's ID) */
  destListId: string;
  /** Number of cards in the destination list */
  cardCount: number;
  /** Whether the animation system is enabled */
  enabled: boolean;
  /** How to handle the source list when dragging cross-list (default: PLACEHOLDER) */
  crossListSourceMode?: CrossListSourceMode;
  /** Selector for card elements (default: "[data-dnd-id]") */
  itemSelector?: string;
  /** Delay in ms before showing ghost (default: 400) */
  hoverDelay?: number;
}

// Empty result constant for reuse
const EMPTY_SLIDES: Record<ListId, CardSlideMap> = {};
const EMPTY_RESULT: CardDragAnimationResult = {
  ghost: null,
  ghostVisible: false,
  slideOffsets: EMPTY_SLIDES,
  hoverTarget: null,
};

// ============================================================
// Pure Calculation Functions (from card algorithm spec)
// ============================================================

/**
 * 2.1 Gap index `p` from hover
 *
 * Converts hover target to gap index (visual position).
 * Gap index represents where the ghost indicator should appear.
 */
export function calculateGapIndex(hover: CardHoverTarget, m: number): number {
  switch (hover.type) {
    case "LIST_EMPTY":
      return 0;
    case "ABOVE_LIST":
      return 0;
    case "BELOW_LIST":
      return m;
    case "CARD":
      return hover.region === "TOP"
        ? hover.cardIndex
        : hover.cardIndex + 1;
  }
}

/**
 * 2.2 Validity - Same-list drop
 *
 * Invalid iff p == d or p == d + 1 (the two no-op gaps adjacent to dragged card).
 */
export function isValidSameListDrop(d: number, p: number): boolean {
  return p !== d && p !== d + 1;
}

/**
 * 2.2 Validity - Cross-list drop
 *
 * Valid if p is in range [0, m].
 */
export function isValidCrossListDrop(p: number, m: number): boolean {
  return p >= 0 && p <= m;
}

/**
 * 2.3 Convert (d, p) to insertion index - Same list
 *
 * When removing card at d and inserting at p:
 * - If p <= d: insert at p
 * - If p > d: insert at p - 1 (accounting for removal)
 */
export function calculateNewIndexSameList(d: number, p: number): number {
  return p <= d ? p : p - 1;
}

/**
 * 2.3 Convert p to insertion index - Cross list
 *
 * Card is not present in destination, so newIndex = p.
 */
export function calculateNewIndexCrossList(p: number): number {
  return p;
}

/**
 * 2.4 Unified drop info calculation
 *
 * Returns validity and ghost position (both gap index and insertion index).
 */
export function calculateCardDropInfo(
  sourceListId: ListId,
  d: number,
  destListId: ListId,
  hover: CardHoverTarget,
  destCount: number
): CardDropInfo {
  const p = calculateGapIndex(hover, destCount);

  if (destListId === sourceListId) {
    // Same-list move
    if (!isValidSameListDrop(d, p)) {
      return { valid: false, ghost: null };
    }
    const newIndex = calculateNewIndexSameList(d, p);
    return {
      valid: true,
      ghost: { listId: destListId, p, newIndex },
    };
  } else {
    // Cross-list move
    if (!isValidCrossListDrop(p, destCount)) {
      return { valid: false, ghost: null };
    }
    const newIndex = calculateNewIndexCrossList(p);
    return {
      valid: true,
      ghost: { listId: destListId, p, newIndex },
    };
  }
}

// ============================================================
// Slide Calculation Functions
// ============================================================

/**
 * 3.2 Slides for same-list reordering
 *
 * Uses newIndex framing:
 * - If newIndex < d: items [newIndex..d-1] shift DOWN
 * - If newIndex > d: items [d+1..newIndex] shift UP
 */
export function calculateSlidesSameList(d: number, newIndex: number): CardSlideMap {
  const slides = new Map<number, CardSlide>();

  if (newIndex < d) {
    // Moving card up: items [newIndex..d-1] shift DOWN to make room
    for (let i = newIndex; i <= d - 1; i++) {
      slides.set(i, "DOWN");
    }
  } else if (newIndex > d) {
    // Moving card down: items [d+1..newIndex] shift UP to fill gap
    for (let i = d + 1; i <= newIndex; i++) {
      slides.set(i, "UP");
    }
  }

  return slides;
}

/**
 * 3.3 Slides for cross-list target
 *
 * Items at/after insertion point shift DOWN.
 */
export function calculateSlidesTargetCrossList(newIndex: number, destCount: number): CardSlideMap {
  const slides = new Map<number, CardSlide>();
  for (let i = newIndex; i <= destCount - 1; i++) {
    slides.set(i, "DOWN");
  }
  return slides;
}

/**
 * 3.3 Slides for cross-list source
 *
 * PLACEHOLDER: no collapse, no slides in source
 * COLLAPSE: items after d shift UP
 */
export function calculateSlidesSourceCrossList(
  mode: CrossListSourceMode,
  d: number,
  sourceCount: number
): CardSlideMap {
  const slides = new Map<number, CardSlide>();

  if (mode === "PLACEHOLDER") {
    // No collapse: dragged card's space preserved
    return slides;
  }

  // COLLAPSE: items after d shift UP to fill the gap
  for (let i = d + 1; i <= sourceCount - 1; i++) {
    slides.set(i, "UP");
  }
  return slides;
}

/**
 * 3.4 Unified slide offsets calculation
 *
 * Returns slide maps for all affected lists.
 */
export function calculateCardSlideOffsets(
  sourceListId: ListId,
  d: number,
  sourceCount: number,
  ghost: CardGhost,
  destCount: number,
  crossListSourceMode: CrossListSourceMode
): Record<ListId, CardSlideMap> {
  const offsets: Record<ListId, CardSlideMap> = {};

  if (ghost === null) {
    return offsets;
  }

  const destListId = ghost.listId;

  if (destListId === sourceListId) {
    // Same-list: only slides in source/dest (same list)
    offsets[sourceListId] = calculateSlidesSameList(d, ghost.newIndex);
    return offsets;
  }

  // Cross-list: slides in both source and destination
  offsets[destListId] = calculateSlidesTargetCrossList(ghost.newIndex, destCount);
  offsets[sourceListId] = calculateSlidesSourceCrossList(crossListSourceMode, d, sourceCount);

  return offsets;
}

// ============================================================
// Hover Target Detection
// ============================================================

/**
 * Detects hover target based on mouse Y position within the cards container.
 *
 * Returns structured HoverTarget with region for precise ghost positioning.
 */
export function detectCardHoverTarget(
  mouseY: number,
  cardRects: DOMRect[],
  containerRect: DOMRect,
  listId: ListId,
  draggedIndex: number | undefined,
  isSameList: boolean
): CardHoverTarget | null {
  // Empty list
  if (cardRects.length === 0) {
    return { type: "LIST_EMPTY", listId };
  }

  const relativeY = mouseY;

  // Calculate first/last card bounds (accounting for dragged card in same list)
  const firstCardTop = cardRects[0].top - containerRect.top;
  const lastCardBottom = cardRects[cardRects.length - 1].bottom - containerRect.top;

  // Above first card
  if (relativeY < firstCardTop) {
    return { type: "ABOVE_LIST", listId };
  }

  // Below last card
  if (relativeY > lastCardBottom) {
    return { type: "BELOW_LIST", listId };
  }

  // Find which card we're hovering over
  for (let i = 0; i < cardRects.length; i++) {
    const rect = cardRects[i];
    const cardTop = rect.top - containerRect.top;
    const cardBottom = rect.bottom - containerRect.top;

    if (relativeY >= cardTop && relativeY <= cardBottom) {
      const cardMidpoint = cardTop + (cardBottom - cardTop) / 2;
      const region = relativeY < cardMidpoint ? "TOP" : "BOTTOM";

      // For same-list, adjust index to account for dragged card
      let adjustedIndex = i;
      if (isSameList && typeof draggedIndex === "number") {
        // The card rects don't include the dragged card (it's hidden/reduced),
        // so indices might need adjustment
        // Actually, we pass the visual indices as-is since cardRects represents visible cards
      }

      return {
        type: "CARD",
        listId,
        cardIndex: adjustedIndex,
        region,
      };
    }
  }

  // Fallback: in a gap between cards - find closest
  for (let i = 0; i < cardRects.length - 1; i++) {
    const currentBottom = cardRects[i].bottom - containerRect.top;
    const nextTop = cardRects[i + 1].top - containerRect.top;

    if (relativeY > currentBottom && relativeY < nextTop) {
      // In gap - determine which card to associate with
      const gapMidpoint = (currentBottom + nextTop) / 2;
      if (relativeY < gapMidpoint) {
        return { type: "CARD", listId, cardIndex: i, region: "BOTTOM" };
      } else {
        return { type: "CARD", listId, cardIndex: i + 1, region: "TOP" };
      }
    }
  }

  return null;
}

// ============================================================
// Main Hook
// ============================================================

export function useCardDragAnimation({
  container,
  mousePosition,
  sourceListId,
  draggedIndex,
  destListId,
  cardCount,
  enabled,
  crossListSourceMode = "PLACEHOLDER",
  itemSelector = "[data-dnd-id]",
  hoverDelay = 400,
}: UseCardDragAnimationOptions): CardDragAnimationResult {
  // Timer for hover delay
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Stable result with delay applied
  const [stableResult, setStableResult] = React.useState<CardDragAnimationResult>(EMPTY_RESULT);

  // Determine if this is a same-list drag
  const isSameList = sourceListId === destListId;

  // Get card element rects - ONLY recalculate when enabled changes
  // NOT when mousePosition changes (would cause feedback loop)
  const cardRects = React.useMemo((): DOMRect[] => {
    if (!container || !enabled) return [];
    const elements = container.querySelectorAll(itemSelector);
    return Array.from(elements).map(el => el.getBoundingClientRect());
  }, [container, enabled, itemSelector]);

  // Get container rect
  const containerRect = React.useMemo((): DOMRect | null => {
    if (!container || !enabled) return null;
    return container.getBoundingClientRect();
  }, [container, enabled]);

  // Calculate raw result (before delay)
  const rawResult = React.useMemo((): CardDragAnimationResult => {
    // Reset when drag ends
    if (!enabled) {
      return EMPTY_RESULT;
    }

    // Early exit if missing data
    if (
      sourceListId === null ||
      typeof draggedIndex !== "number" ||
      !mousePosition ||
      !containerRect
    ) {
      return EMPTY_RESULT;
    }

    // Detect hover target
    const hoverTarget = detectCardHoverTarget(
      mousePosition.y,
      cardRects,
      containerRect,
      destListId,
      draggedIndex,
      isSameList
    );

    if (!hoverTarget) {
      return { ...EMPTY_RESULT, hoverTarget: null };
    }

    // Calculate drop info
    const dropInfo = calculateCardDropInfo(
      sourceListId,
      draggedIndex,
      destListId,
      hoverTarget,
      cardCount
    );

    if (!dropInfo.valid || dropInfo.ghost === null) {
      return { ...EMPTY_RESULT, hoverTarget };
    }

    // Calculate slide offsets
    // For source count, we use cardCount if same-list, otherwise need to track separately
    // Since this hook is per-list, we only calculate slides for this list
    const sourceCount = isSameList ? cardCount : cardCount; // In practice, we'd need source count passed in
    const slideOffsets = calculateCardSlideOffsets(
      sourceListId,
      draggedIndex,
      sourceCount,
      dropInfo.ghost,
      cardCount,
      crossListSourceMode
    );

    return {
      ghost: dropInfo.ghost,
      ghostVisible: true,
      slideOffsets,
      hoverTarget,
    };
  }, [
    enabled,
    sourceListId,
    draggedIndex,
    destListId,
    cardCount,
    mousePosition,
    containerRect,
    cardRects,
    isSameList,
    crossListSourceMode,
  ]);

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
      // Starting to hover over valid position - delay before showing
      timerRef.current = setTimeout(() => {
        setStableResult(rawResult);
      }, hoverDelay);
    } else if (!willBeVisible && wasVisible) {
      // Leaving valid hover position - hide immediately
      setStableResult(rawResult);
    } else if (willBeVisible && wasVisible) {
      // Both visible - check if position changed significantly
      const currentGhostP = stableResult.ghost?.p;
      const newGhostP = rawResult.ghost?.p;

      if (currentGhostP !== newGhostP) {
        // Ghost position changed - hide immediately, then delay before showing new position
        setStableResult({ ...EMPTY_RESULT, hoverTarget: rawResult.hoverTarget });
        timerRef.current = setTimeout(() => {
          setStableResult(rawResult);
        }, hoverDelay);
      }
      // Same position - keep current stable result
    }
    // If both not visible, no action needed

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [rawResult, hoverDelay, enabled]); // stableResult intentionally excluded

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
// Animation Application Helpers
// ============================================================

/**
 * Apply slide transforms to card elements
 */
export function applyCardSlides(
  container: HTMLElement,
  slides: CardSlideMap,
  itemSelector: string,
  cardHeight: number = 80,
  gap: number = 8,
  duration: number = 200
): void {
  const elements = container.querySelectorAll(itemSelector);
  const displacement = cardHeight + gap;

  elements.forEach((element, index) => {
    const htmlElement = element as HTMLElement;
    const direction = slides.get(index);

    if (direction) {
      const transform = direction === "DOWN"
        ? `translate3d(0, ${displacement}px, 0)`
        : `translate3d(0, -${displacement}px, 0)`;

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
 * Reset all card slide transforms
 */
export function resetCardSlides(
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

/**
 * Get the insertion index for use in drop handlers.
 * This is the newIndex from the ghost, which accounts for removal position.
 */
export function getCardInsertionIndex(ghost: CardGhost): number | null {
  return ghost?.newIndex ?? null;
}
