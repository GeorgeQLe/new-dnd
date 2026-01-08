"use client";

import * as React from "react";
import type { UniqueId, Rect } from "../core/types";
import { getRect } from "../core/utils";
import { FLIP_ANIMATION_DURATION, FLIP_ANIMATION_EASING } from "../core/constants";

// ============================================================
// Types
// ============================================================
interface UseFLIPAnimationConfig<T extends { id: UniqueId }> {
  /** Array of items to track */
  items: T[];
  /** Ref to the container element */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Animation duration in ms */
  duration?: number;
  /** CSS easing function */
  easing?: string;
  /** Selector for finding item elements (default: [data-dnd-id]) */
  itemSelector?: string;
}

interface UseFLIPAnimationReturn {
  /** Call before state update to snapshot positions */
  snapshot: () => void;
  /** Call after state update to animate */
  animate: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================
export function useFLIPAnimation<T extends { id: UniqueId }>({
  items,
  containerRef,
  duration = FLIP_ANIMATION_DURATION,
  easing = FLIP_ANIMATION_EASING,
  itemSelector = "[data-dnd-id]",
}: UseFLIPAnimationConfig<T>): UseFLIPAnimationReturn {
  const previousPositions = React.useRef<Map<UniqueId, Rect>>(new Map());
  const isAnimating = React.useRef(false);
  const animationsRef = React.useRef<Animation[]>([]);

  /**
   * Snapshot current positions of all items
   * Call this BEFORE updating state
   */
  const snapshot = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    previousPositions.current.clear();

    items.forEach((item) => {
      const element = container.querySelector(
        `[data-dnd-id="${item.id}"]`
      ) as HTMLElement | null;

      if (element) {
        previousPositions.current.set(item.id, getRect(element));
      }
    });
  }, [items, containerRef]);

  /**
   * Animate items from their previous positions to current
   * Call this AFTER updating state (in useLayoutEffect)
   */
  const animate = React.useCallback(() => {
    const container = containerRef.current;
    if (!container || isAnimating.current) return;

    // Cancel any ongoing animations
    animationsRef.current.forEach((anim) => anim.cancel());
    animationsRef.current = [];

    const animations: Animation[] = [];

    items.forEach((item) => {
      const element = container.querySelector(
        `[data-dnd-id="${item.id}"]`
      ) as HTMLElement | null;
      const previousRect = previousPositions.current.get(item.id);

      if (element && previousRect) {
        const currentRect = getRect(element);
        const deltaX = previousRect.left - currentRect.left;
        const deltaY = previousRect.top - currentRect.top;

        // Only animate if there's actual movement
        if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
          const animation = element.animate(
            [
              { transform: `translate(${deltaX}px, ${deltaY}px)` },
              { transform: "translate(0, 0)" },
            ],
            {
              duration,
              easing,
              fill: "backwards",
            }
          );
          animations.push(animation);
        }
      }
    });

    if (animations.length > 0) {
      isAnimating.current = true;
      animationsRef.current = animations;

      // Cleanup after all animations complete
      Promise.all(animations.map((a) => a.finished))
        .then(() => {
          isAnimating.current = false;
          previousPositions.current.clear();
          animationsRef.current = [];
        })
        .catch(() => {
          // Animation was cancelled
          isAnimating.current = false;
          animationsRef.current = [];
        });
    } else {
      previousPositions.current.clear();
    }
  }, [items, containerRef, duration, easing]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      animationsRef.current.forEach((anim) => anim.cancel());
    };
  }, []);

  return { snapshot, animate };
}

// ============================================================
// Simpler hook for single-element FLIP
// ============================================================
interface UseSingleFLIPConfig {
  /** Ref to the element to animate */
  elementRef: React.RefObject<HTMLElement | null>;
  /** Dependency that triggers animation when changed */
  dependency: unknown;
  /** Animation duration in ms */
  duration?: number;
  /** CSS easing function */
  easing?: string;
}

export function useSingleFLIP({
  elementRef,
  dependency,
  duration = FLIP_ANIMATION_DURATION,
  easing = FLIP_ANIMATION_EASING,
}: UseSingleFLIPConfig): void {
  const previousRect = React.useRef<Rect | null>(null);

  // Capture position before render
  React.useLayoutEffect(() => {
    const element = elementRef.current;
    if (element) {
      previousRect.current = getRect(element);
    }
  });

  // Animate after render when dependency changes
  React.useLayoutEffect(() => {
    const element = elementRef.current;
    const prevRect = previousRect.current;

    if (!element || !prevRect) return;

    const currentRect = getRect(element);
    const deltaX = prevRect.left - currentRect.left;
    const deltaY = prevRect.top - currentRect.top;

    if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration,
          easing,
          fill: "backwards",
        }
      );
    }
  }, [dependency, duration, easing, elementRef]);
}
