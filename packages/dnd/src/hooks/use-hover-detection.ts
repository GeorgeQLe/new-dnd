"use client";

import * as React from "react";
import type { Coordinates } from "../core/types";
import { throttle } from "../utils/performance";

// ============================================================
// Types
// ============================================================
interface HoverState {
  isHovering: boolean;
  hoverStartTime: number | null;
  shouldShowPreview: boolean;
  lastMousePosition: Coordinates | null;
  initialHoverPosition: Coordinates | null;
}

interface UseHoverDetectionOptions {
  /** Delay in milliseconds before preview animations trigger */
  delay?: number;
  /** Movement threshold in pixels that resets the timer */
  threshold?: number;
  /** Whether hover detection is enabled */
  enabled?: boolean;
}

interface UseHoverDetectionReturn {
  /** Whether the element is currently being hovered */
  isHovering: boolean;
  /** Whether preview animations should be shown */
  shouldShowPreview: boolean;
  /** Current mouse position relative to the element */
  mousePosition: Coordinates | null;
  /** Handlers for mouse events */
  hoverHandlers: {
    onMouseEnter: (event: React.MouseEvent) => void;
    onMouseMove: (event: React.MouseEvent) => void;
    onMouseLeave: () => void;
  };
  /** Manual trigger for ending hover state */
  endHover: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================
export function useHoverDetection({
  delay = 500,
  threshold = 10,
  enabled = true,
}: UseHoverDetectionOptions = {}): UseHoverDetectionReturn {
  const [state, setState] = React.useState<HoverState>({
    isHovering: false,
    hoverStartTime: null,
    shouldShowPreview: false,
    lastMousePosition: null,
    initialHoverPosition: null,
  });

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const elementRef = React.useRef<HTMLElement | null>(null);
  
  // Safeguard against infinite re-renders
  const renderCountRef = React.useRef(0);
  const lastRenderTimeRef = React.useRef(Date.now());
  
  React.useEffect(() => {
    const now = Date.now();
    if (now - lastRenderTimeRef.current < 100) {
      renderCountRef.current += 1;
      if (renderCountRef.current > 10) {
        console.warn('useHoverDetection: Potential infinite re-render detected, disabling temporarily');
        return;
      }
    } else {
      renderCountRef.current = 0;
    }
    lastRenderTimeRef.current = now;
  });

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Helper function to calculate distance between two points - stable reference
  const calculateDistance = React.useCallback((pos1: Coordinates, pos2: Coordinates): number => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Helper function to get mouse position relative to element - stable reference
  const getRelativeMousePosition = React.useCallback(
    (event: React.MouseEvent): Coordinates => {
      const rect = event.currentTarget.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },
    []
  );

  // Clear any existing timer
  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start preview timer
  const startTimer = React.useCallback(() => {
    clearTimer();
    
    timerRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        shouldShowPreview: true,
      }));
      timerRef.current = null;
    }, delay);
  }, [delay, clearTimer]);

  // Handle mouse enter
  const handleMouseEnter = React.useCallback(
    (event: React.MouseEvent) => {
      if (!enabled) return;

      elementRef.current = event.currentTarget as HTMLElement;
      const mousePos = getRelativeMousePosition(event);

      setState({
        isHovering: true,
        hoverStartTime: Date.now(),
        shouldShowPreview: false,
        lastMousePosition: mousePos,
        initialHoverPosition: mousePos,
      });

      startTimer();
    },
    [enabled, getRelativeMousePosition, startTimer]
  );

  // Throttled mouse move handler with stable dependencies
  const handleMouseMoveThrottled = React.useMemo(
    () => throttle((event: React.MouseEvent) => {
      // Use current state ref to avoid stale closures
      if (!enabled) return;

      const currentState = state;
      if (!currentState.isHovering || !currentState.initialHoverPosition) return;

      const currentMousePos = getRelativeMousePosition(event);
      const distance = calculateDistance(currentMousePos, currentState.initialHoverPosition);

      // Direct state updates without RAF to prevent React conflicts
      setState(prev => ({
        ...prev,
        lastMousePosition: currentMousePos,
      }));

      // If movement exceeds threshold, reset timer and preview state
      if (distance > threshold) {
        clearTimer();
        
        setState(prev => ({
          ...prev,
          shouldShowPreview: false,
          initialHoverPosition: currentMousePos,
          hoverStartTime: Date.now(),
        }));

        // Start new timer from this position
        startTimer();
      }
    }, 16), // ~60fps throttling
    [
      enabled,
      getRelativeMousePosition,
      calculateDistance,
      threshold,
      clearTimer,
      startTimer,
    ]
  );

  // Cleanup throttled function on unmount
  React.useEffect(() => {
    return () => {
      handleMouseMoveThrottled.cancel();
    };
  }, [handleMouseMoveThrottled]);

  const handleMouseMove = React.useCallback(
    (event: React.MouseEvent) => {
      handleMouseMoveThrottled(event);
    },
    [handleMouseMoveThrottled]
  );

  // Handle mouse leave
  const handleMouseLeave = React.useCallback(() => {
    clearTimer();
    
    setState({
      isHovering: false,
      hoverStartTime: null,
      shouldShowPreview: false,
      lastMousePosition: null,
      initialHoverPosition: null,
    });
  }, [clearTimer]);

  // Manual end hover function
  const endHover = React.useCallback(() => {
    handleMouseLeave();
  }, [handleMouseLeave]);

  return {
    isHovering: state.isHovering,
    shouldShowPreview: state.shouldShowPreview,
    mousePosition: state.lastMousePosition,
    hoverHandlers: {
      onMouseEnter: handleMouseEnter,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
    endHover,
  };
}

// ============================================================
// Utility hook for calculating drop positions
// ============================================================
interface UseDropPositionOptions {
  /** Element dimensions for position calculations */
  elementRect: DOMRect | null;
  /** Current mouse position relative to element */
  mousePosition: Coordinates | null;
}

interface DropPositionData {
  /** Where the item would be inserted relative to this element */
  insertPosition: "before" | "after";
  /** Percentage through the element (0-1) */
  positionRatio: number;
  /** Whether mouse is in top half (for vertical layouts) */
  isTopHalf: boolean;
  /** Whether mouse is in left half (for horizontal layouts) */
  isLeftHalf: boolean;
}

export function useDropPosition({
  elementRect,
  mousePosition,
}: UseDropPositionOptions): DropPositionData | null {
  return React.useMemo(() => {
    if (!elementRect || !mousePosition) {
      return null;
    }

    // Calculate position ratios
    const horizontalRatio = mousePosition.x / elementRect.width;
    const verticalRatio = mousePosition.y / elementRect.height;
    
    // Determine insert position based on which half the mouse is in
    const isTopHalf = verticalRatio < 0.5;
    const isLeftHalf = horizontalRatio < 0.5;
    
    return {
      insertPosition: isTopHalf ? "before" : "after",
      positionRatio: verticalRatio,
      isTopHalf,
      isLeftHalf,
    };
  }, [elementRect, mousePosition]);
}