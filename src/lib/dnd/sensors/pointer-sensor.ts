import type { Coordinates } from "../core/types";
import { ACTIVATION_DELAY, ACTIVATION_DISTANCE } from "../core/constants";
import { rafThrottle } from "../core/utils";

// ============================================================
// Types
// ============================================================
export interface PointerSensorConfig {
  /** Delay before drag activates (ms) */
  activationDelay?: number;
  /** Distance to move before drag activates (px) */
  activationDistance?: number;
  /** Called when drag activates */
  onActivate: (origin: Coordinates) => void;
  /** Called on pointer move during drag */
  onMove: (current: Coordinates) => void;
  /** Called when drag ends normally */
  onEnd: (current: Coordinates) => void;
  /** Called when drag is cancelled */
  onCancel: () => void;
}

// ============================================================
// Pointer Sensor Class
// ============================================================
export class PointerSensor {
  private config: Required<PointerSensorConfig>;
  private isActive = false;
  private isPending = false;
  private origin: Coordinates | null = null;
  private activationTimeoutId: number | null = null;
  private boundElement: HTMLElement | null = null;
  private pointerId: number | null = null;

  // Throttled move handler
  private throttledMove: ((current: Coordinates) => void) & { cancel: () => void };

  constructor(config: PointerSensorConfig) {
    this.config = {
      activationDelay: config.activationDelay ?? ACTIVATION_DELAY,
      activationDistance: config.activationDistance ?? ACTIVATION_DISTANCE,
      onActivate: config.onActivate,
      onMove: config.onMove,
      onEnd: config.onEnd,
      onCancel: config.onCancel,
    };

    this.throttledMove = rafThrottle((current: Coordinates) => {
      this.config.onMove(current);
    });
  }

  /**
   * Attach the sensor to an element
   */
  attach(element: HTMLElement): void {
    this.boundElement = element;
    element.addEventListener("pointerdown", this.handlePointerDown);
  }

  /**
   * Detach the sensor from the element
   */
  detach(): void {
    if (this.boundElement) {
      this.boundElement.removeEventListener("pointerdown", this.handlePointerDown);
      this.boundElement = null;
    }
    this.cleanup();
  }

  /**
   * Check if the sensor is currently active (dragging)
   */
  get active(): boolean {
    return this.isActive;
  }

  // ============================================================
  // Event Handlers
  // ============================================================
  private handlePointerDown = (e: PointerEvent): void => {
    // Primary button only (left click or touch)
    if (e.button !== 0) return;

    // Don't start if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("button, input, textarea, select, a, [data-no-drag]")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    this.origin = { x: e.clientX, y: e.clientY };
    this.pointerId = e.pointerId;
    this.isPending = true;

    // Capture pointer for reliable tracking outside element bounds
    target.setPointerCapture(e.pointerId);

    // Set up activation timeout
    this.activationTimeoutId = window.setTimeout(() => {
      if (this.isPending && this.origin) {
        this.activate();
      }
    }, this.config.activationDelay);

    // Add document-level listeners
    document.addEventListener("pointermove", this.handlePointerMove);
    document.addEventListener("pointerup", this.handlePointerUp);
    document.addEventListener("pointercancel", this.handlePointerCancel);
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("contextmenu", this.handleContextMenu);
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;

    const current: Coordinates = { x: e.clientX, y: e.clientY };

    // Check activation by distance if still pending
    if (this.isPending && !this.isActive && this.origin) {
      const distance = Math.hypot(
        current.x - this.origin.x,
        current.y - this.origin.y
      );

      if (distance >= this.config.activationDistance) {
        this.clearActivationTimeout();
        this.activate();
      }
    }

    // Update position if active
    if (this.isActive) {
      this.throttledMove(current);
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;

    // Release pointer capture
    const target = e.target as HTMLElement;
    if (target.hasPointerCapture?.(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }

    if (this.isActive) {
      this.config.onEnd({ x: e.clientX, y: e.clientY });
    }

    this.cleanup();
  };

  private handlePointerCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;

    this.config.onCancel();
    this.cleanup();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      this.config.onCancel();
      this.cleanup();
    }
  };

  private handleContextMenu = (e: Event): void => {
    // Prevent context menu during drag
    if (this.isActive || this.isPending) {
      e.preventDefault();
    }
  };

  // ============================================================
  // Internal Methods
  // ============================================================
  private activate(): void {
    if (!this.origin) return;

    this.isActive = true;
    this.isPending = false;
    this.config.onActivate(this.origin);

    // Add dragging class to body for cursor styling
    document.body.classList.add("dnd-dragging");
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  private clearActivationTimeout(): void {
    if (this.activationTimeoutId !== null) {
      window.clearTimeout(this.activationTimeoutId);
      this.activationTimeoutId = null;
    }
  }

  private cleanup(): void {
    this.clearActivationTimeout();
    this.throttledMove.cancel();

    this.isActive = false;
    this.isPending = false;
    this.origin = null;
    this.pointerId = null;

    // Remove document-level listeners
    document.removeEventListener("pointermove", this.handlePointerMove);
    document.removeEventListener("pointerup", this.handlePointerUp);
    document.removeEventListener("pointercancel", this.handlePointerCancel);
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("contextmenu", this.handleContextMenu);

    // Remove dragging styles
    document.body.classList.remove("dnd-dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }
}

// ============================================================
// Factory function for creating sensors
// ============================================================
export function createPointerSensor(config: PointerSensorConfig): PointerSensor {
  return new PointerSensor(config);
}
