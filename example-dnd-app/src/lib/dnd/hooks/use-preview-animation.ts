"use client";

import * as React from "react";
import { TransformBuilder, scheduleUpdate } from "../utils/performance";

// ============================================================
// Types
// ============================================================
interface AnimationState {
  isAnimating: boolean;
  isReverting: boolean;
  showPreview: boolean;
  previewOpacity: number;
  displacementOffset: number;
}

interface UsePreviewAnimationOptions {
  /** Whether the preview should be shown */
  shouldShow: boolean;
  /** Displacement distance in pixels */
  displacementDistance?: number;
  /** Animation durations in milliseconds */
  durations?: {
    displacement: number;
    previewFadeIn: number;
    reversion: number;
  };
  /** Target opacity for the preview element */
  targetOpacity?: number;
}

interface UsePreviewAnimationReturn {
  /** Current animation state */
  animationState: AnimationState;
  /** Styles for the displaced element */
  displacementStyles: React.CSSProperties;
  /** Styles for the preview ghost element */
  previewStyles: React.CSSProperties;
  /** Whether any animation is currently playing */
  isPlaying: boolean;
}

// Default configuration
const DEFAULT_DURATIONS = {
  displacement: 250,
  previewFadeIn: 300,
  reversion: 200,
};

// ============================================================
// Hook Implementation
// ============================================================
export function usePreviewAnimation({
  shouldShow,
  displacementDistance = 0,
  durations = DEFAULT_DURATIONS,
  targetOpacity = 0.6,
}: UsePreviewAnimationOptions): UsePreviewAnimationReturn {
  const [animationState, setAnimationState] = React.useState<AnimationState>({
    isAnimating: false,
    isReverting: false,
    showPreview: false,
    previewOpacity: 0,
    displacementOffset: 0,
  });

  const timeoutRefs = React.useRef<{
    displacement?: NodeJS.Timeout;
    preview?: NodeJS.Timeout;
    reversion?: NodeJS.Timeout;
  }>({});

  // Safeguard against infinite re-renders
  const renderCountRef = React.useRef(0);
  const lastRenderTimeRef = React.useRef(Date.now());
  
  React.useEffect(() => {
    const now = Date.now();
    if (now - lastRenderTimeRef.current < 50) {
      renderCountRef.current += 1;
      if (renderCountRef.current > 15) {
        console.warn('usePreviewAnimation: Potential infinite re-render detected, stabilizing');
        return;
      }
    } else {
      renderCountRef.current = 0;
    }
    lastRenderTimeRef.current = now;
  });

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Clear all timeouts helper
  const clearAllTimeouts = React.useCallback(() => {
    Object.values(timeoutRefs.current).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });
    timeoutRefs.current = {};
  }, []);

  // Start animation sequence
  const startAnimation = React.useCallback(() => {
    clearAllTimeouts();

    // Single atomic state update to prevent multiple re-renders
    setAnimationState(prev => ({
      ...prev,
      isAnimating: true,
      isReverting: false,
      showPreview: false,
      previewOpacity: 0,
      displacementOffset: displacementDistance, // Start displacement immediately
    }));

    // Start preview fade-in after a slight delay to allow displacement to begin
    timeoutRefs.current.preview = setTimeout(() => {
      setAnimationState(prev => ({
        ...prev,
        showPreview: true,
        previewOpacity: targetOpacity,
      }));
    }, 50); // Small delay for displacement to start

    // Mark animation as complete after displacement duration
    timeoutRefs.current.displacement = setTimeout(() => {
      setAnimationState(prev => ({
        ...prev,
        isAnimating: false,
      }));
    }, durations.displacement);
  }, [displacementDistance, targetOpacity, durations, clearAllTimeouts]);

  // Start reversion sequence
  const startReversion = React.useCallback(() => {
    clearAllTimeouts();

    // Single atomic state update for reversion
    setAnimationState(prev => ({
      ...prev,
      isAnimating: false,
      isReverting: true,
      previewOpacity: 0,
      displacementOffset: 0,
    }));

    // Hide preview completely after fade duration
    timeoutRefs.current.preview = setTimeout(() => {
      setAnimationState(prev => ({
        ...prev,
        showPreview: false,
      }));
    }, durations.reversion);

    // Mark reversion as complete
    timeoutRefs.current.reversion = setTimeout(() => {
      setAnimationState(prev => ({
        ...prev,
        isReverting: false,
      }));
    }, durations.reversion);
  }, [durations, clearAllTimeouts]);

  // React to shouldShow changes
  React.useEffect(() => {
    if (shouldShow && !animationState.isAnimating && !animationState.showPreview) {
      startAnimation();
    } else if (!shouldShow && (animationState.showPreview || animationState.isAnimating)) {
      startReversion();
    }
  }, [shouldShow, animationState, startAnimation, startReversion]);

  // Generate displacement styles with optimized transforms
  const displacementStyles: React.CSSProperties = React.useMemo(() => {
    const transform = TransformBuilder.create()
      .translate3d(0, animationState.displacementOffset, 0)
      .build();

    return {
      transform,
      transition: animationState.isReverting 
        ? `transform ${durations.reversion}ms ease-out`
        : `transform ${durations.displacement}ms ease-out`,
      willChange: 'transform', // Enable hardware acceleration
      backfaceVisibility: 'hidden', // Prevent flickering
    };
  }, [animationState.displacementOffset, animationState.isReverting, durations]);

  // Generate preview styles with hardware acceleration
  const previewStyles: React.CSSProperties = React.useMemo(() => {
    const transform = TransformBuilder.create().scale(1).build();

    return {
      opacity: animationState.previewOpacity,
      transform,
      transition: animationState.isReverting
        ? `opacity ${durations.reversion}ms ease-out`
        : `opacity ${durations.previewFadeIn}ms ease-out`,
      animation: animationState.showPreview ? 'preview-pulse 2s ease-in-out infinite' : 'none',
      filter: 'drop-shadow(0 4px 12px rgba(var(--primary), 0.3))',
      pointerEvents: 'none' as const,
      willChange: 'opacity, transform', // Enable hardware acceleration
      backfaceVisibility: 'hidden', // Prevent flickering
    };
  }, [animationState.previewOpacity, animationState.showPreview, animationState.isReverting, durations]);

  return {
    animationState,
    displacementStyles,
    previewStyles,
    isPlaying: animationState.isAnimating || animationState.isReverting,
  };
}

// ============================================================
// List Animation Hook (for horizontal displacement)
// ============================================================
interface UseListPreviewAnimationOptions {
  /** Whether the preview should be shown */
  shouldShow: boolean;
  /** Direction of displacement */
  direction: "left" | "right";
  /** Displacement distance in pixels */
  displacementDistance?: number;
  /** Animation durations in milliseconds */
  durations?: {
    displacement: number;
    previewFadeIn: number;
    reversion: number;
  };
}

export function useListPreviewAnimation({
  shouldShow,
  direction,
  displacementDistance = 320, // Default list width
  durations = DEFAULT_DURATIONS,
}: UseListPreviewAnimationOptions): UsePreviewAnimationReturn {
  const [animationState, setAnimationState] = React.useState<AnimationState>({
    isAnimating: false,
    isReverting: false,
    showPreview: false,
    previewOpacity: 0,
    displacementOffset: 0,
  });

  const timeoutRefs = React.useRef<{
    displacement?: NodeJS.Timeout;
    preview?: NodeJS.Timeout;
    reversion?: NodeJS.Timeout;
  }>({});

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  const clearAllTimeouts = React.useCallback(() => {
    Object.values(timeoutRefs.current).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });
    timeoutRefs.current = {};
  }, []);

  // Calculate displacement direction
  const displacement = direction === "left" ? -displacementDistance : displacementDistance;

  // Start animation sequence
  const startAnimation = React.useCallback(() => {
    clearAllTimeouts();

    // Single atomic state update for list animation
    setAnimationState(prev => ({
      ...prev,
      isAnimating: true,
      isReverting: false,
      showPreview: false,
      previewOpacity: 0,
      displacementOffset: displacement,
    }));

    // Start preview fade-in after displacement starts
    timeoutRefs.current.preview = setTimeout(() => {
      setAnimationState(prev => ({
        ...prev,
        showPreview: true,
        previewOpacity: 0.6,
      }));
    }, 50);

    // Mark animation complete
    timeoutRefs.current.displacement = setTimeout(() => {
      setAnimationState(prev => ({
        ...prev,
        isAnimating: false,
      }));
    }, durations.displacement);
  }, [displacement, durations, clearAllTimeouts]);

  // Start reversion
  const startReversion = React.useCallback(() => {
    clearAllTimeouts();

    // Single atomic state update for list reversion
    setAnimationState(prev => ({
      ...prev,
      isAnimating: false,
      isReverting: true,
      previewOpacity: 0,
      displacementOffset: 0,
    }));

    timeoutRefs.current.preview = setTimeout(() => {
      setAnimationState(prev => ({
        ...prev,
        showPreview: false,
      }));
    }, durations.reversion);

    timeoutRefs.current.reversion = setTimeout(() => {
      setAnimationState(prev => ({
        ...prev,
        isReverting: false,
      }));
    }, durations.reversion);
  }, [durations, clearAllTimeouts]);

  // React to shouldShow changes
  React.useEffect(() => {
    if (shouldShow && !animationState.isAnimating && !animationState.showPreview) {
      startAnimation();
    } else if (!shouldShow && (animationState.showPreview || animationState.isAnimating)) {
      startReversion();
    }
  }, [shouldShow, animationState, startAnimation, startReversion]);

  // Generate horizontal displacement styles with optimized transforms
  const displacementStyles: React.CSSProperties = React.useMemo(() => {
    const transform = TransformBuilder.create()
      .translate3d(animationState.displacementOffset, 0, 0)
      .build();

    return {
      transform,
      transition: animationState.isReverting 
        ? `transform ${durations.reversion}ms ease-out`
        : `transform ${durations.displacement}ms ease-out`,
      willChange: 'transform', // Enable hardware acceleration
      backfaceVisibility: 'hidden', // Prevent flickering
    };
  }, [animationState.displacementOffset, animationState.isReverting, durations]);

  // Generate preview styles with hardware acceleration
  const previewStyles: React.CSSProperties = React.useMemo(() => {
    const transform = TransformBuilder.create().scale(1).build();

    return {
      opacity: animationState.previewOpacity,
      transform,
      transition: animationState.isReverting
        ? `opacity ${durations.reversion}ms ease-out`
        : `opacity ${durations.previewFadeIn}ms ease-out`,
      animation: animationState.showPreview ? 'preview-pulse 2s ease-in-out infinite' : 'none',
      filter: 'drop-shadow(0 4px 12px rgba(var(--primary), 0.3))',
      pointerEvents: 'none' as const,
      willChange: 'opacity, transform', // Enable hardware acceleration
      backfaceVisibility: 'hidden', // Prevent flickering
    };
  }, [animationState.previewOpacity, animationState.showPreview, animationState.isReverting, durations]);

  return {
    animationState,
    displacementStyles,
    previewStyles,
    isPlaying: animationState.isAnimating || animationState.isReverting,
  };
}