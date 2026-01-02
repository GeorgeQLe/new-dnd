// Activation delay in milliseconds before drag starts
// Prevents accidental drags from clicks
export const ACTIVATION_DELAY = 150;

// Minimum distance in pixels to bypass activation delay
// Allows intentional quick drags to start immediately
export const ACTIVATION_DISTANCE = 5;

// Animation duration for FLIP transitions
export const FLIP_ANIMATION_DURATION = 200;

// Animation easing for smooth transitions
export const FLIP_ANIMATION_EASING = "cubic-bezier(0.2, 0, 0, 1)";

// Z-index for drag overlay
export const DRAG_OVERLAY_Z_INDEX = 9999;

// Scale factor for dragging items
export const DRAG_SCALE = 1.02;

// CSS custom properties used for transforms
export const CSS_VARS = {
  translateX: "--dnd-translate-x",
  translateY: "--dnd-translate-y",
  scale: "--dnd-scale",
} as const;