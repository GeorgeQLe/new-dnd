import type { UniqueId, Coordinates } from "../core/types";

// ============================================================
// Types
// ============================================================
export type KeyboardDirection = "up" | "down" | "left" | "right";

export interface KeyboardSensorConfig {
  /** Called when drag is activated via keyboard (Space/Enter) */
  onActivate: (itemId: UniqueId, origin: Coordinates) => void;
  /** Called when arrow keys are pressed during drag */
  onMove: (direction: KeyboardDirection) => void;
  /** Called when drag is confirmed (Space/Enter while dragging) */
  onConfirm: () => void;
  /** Called when drag is cancelled (Escape) */
  onCancel: () => void;
}

// ============================================================
// Keyboard Sensor Class
// ============================================================
export class KeyboardSensor {
  private config: KeyboardSensorConfig;
  private isActive = false;
  private activeItemId: UniqueId | null = null;
  private boundElement: HTMLElement | null = null;

  constructor(config: KeyboardSensorConfig) {
    this.config = config;
  }

  /**
   * Attach the sensor to an element
   */
  attach(element: HTMLElement, itemId: UniqueId): void {
    this.boundElement = element;
    this.activeItemId = itemId;

    element.addEventListener("keydown", this.handleKeyDown);
    element.addEventListener("blur", this.handleBlur);
  }

  /**
   * Detach the sensor from the element
   */
  detach(): void {
    if (this.boundElement) {
      this.boundElement.removeEventListener("keydown", this.handleKeyDown);
      this.boundElement.removeEventListener("blur", this.handleBlur);
      this.boundElement = null;
    }
    this.activeItemId = null;
    this.isActive = false;
  }

  /**
   * Check if the sensor is currently active (keyboard dragging)
   */
  get active(): boolean {
    return this.isActive;
  }

  /**
   * Programmatically deactivate the sensor
   */
  deactivate(): void {
    this.isActive = false;
  }

  // ============================================================
  // Event Handlers
  // ============================================================
  private handleKeyDown = (e: KeyboardEvent): void => {
    // Activate with Space or Enter
    if (!this.isActive && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      e.stopPropagation();

      if (this.activeItemId && this.boundElement) {
        this.isActive = true;

        // Calculate origin from element center
        const rect = this.boundElement.getBoundingClientRect();
        const origin: Coordinates = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };

        this.config.onActivate(this.activeItemId, origin);
      }
      return;
    }

    // If not active, ignore other keys
    if (!this.isActive) return;

    e.preventDefault();
    e.stopPropagation();

    switch (e.key) {
      case "ArrowUp":
        this.config.onMove("up");
        break;

      case "ArrowDown":
        this.config.onMove("down");
        break;

      case "ArrowLeft":
        this.config.onMove("left");
        break;

      case "ArrowRight":
        this.config.onMove("right");
        break;

      case " ":
      case "Enter":
        this.isActive = false;
        this.config.onConfirm();
        break;

      case "Escape":
        this.isActive = false;
        this.config.onCancel();
        break;

      case "Tab":
        // Allow tab to escape, but cancel drag
        this.isActive = false;
        this.config.onCancel();
        // Don't prevent default to allow focus to move
        break;
    }
  };

  private handleBlur = (): void => {
    // Cancel drag if element loses focus
    if (this.isActive) {
      this.isActive = false;
      this.config.onCancel();
    }
  };
}

// ============================================================
// Factory function for creating sensors
// ============================================================
export function createKeyboardSensor(
  config: KeyboardSensorConfig
): KeyboardSensor {
  return new KeyboardSensor(config);
}

// ============================================================
// Utility for calculating new position from keyboard direction
// ============================================================
export interface KeyboardMoveResult {
  /** New index within the current list */
  newIndex: number;
  /** New list ID if moving between lists */
  newListId?: UniqueId;
}

export function calculateKeyboardMove(
  direction: KeyboardDirection,
  currentIndex: number,
  currentListId: UniqueId,
  listItemCounts: Map<UniqueId, number>,
  listOrder: UniqueId[],
  isVertical = true
): KeyboardMoveResult {
  const currentListIndex = listOrder.indexOf(currentListId);
  const currentListCount = listItemCounts.get(currentListId) ?? 0;

  if (isVertical) {
    // Vertical list behavior
    switch (direction) {
      case "up":
        // Move up within list
        if (currentIndex > 0) {
          return { newIndex: currentIndex - 1 };
        }
        return { newIndex: currentIndex };

      case "down":
        // Move down within list
        if (currentIndex < currentListCount - 1) {
          return { newIndex: currentIndex + 1 };
        }
        return { newIndex: currentIndex };

      case "left":
        // Move to previous list
        if (currentListIndex > 0) {
          const newListId = listOrder[currentListIndex - 1];
          const newListCount = listItemCounts.get(newListId) ?? 0;
          return {
            newIndex: Math.min(currentIndex, newListCount),
            newListId,
          };
        }
        return { newIndex: currentIndex };

      case "right":
        // Move to next list
        if (currentListIndex < listOrder.length - 1) {
          const newListId = listOrder[currentListIndex + 1];
          const newListCount = listItemCounts.get(newListId) ?? 0;
          return {
            newIndex: Math.min(currentIndex, newListCount),
            newListId,
          };
        }
        return { newIndex: currentIndex };
    }
  } else {
    // Horizontal list behavior (for list reordering)
    switch (direction) {
      case "left":
        if (currentIndex > 0) {
          return { newIndex: currentIndex - 1 };
        }
        return { newIndex: currentIndex };

      case "right":
        if (currentIndex < currentListCount - 1) {
          return { newIndex: currentIndex + 1 };
        }
        return { newIndex: currentIndex };

      default:
        return { newIndex: currentIndex };
    }
  }
}
