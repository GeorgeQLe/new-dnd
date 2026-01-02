"use client";

import * as React from "react";
import { useDndContext } from "../core/context";
import type { UniqueId, DragType, Coordinates } from "../core/types";
import { ACTIVATION_DISTANCE } from "../core/constants";

// ============================================================
// Types
// ============================================================
interface UseDraggableConfig {
  id: UniqueId;
  type: DragType;
  data?: Record<string, unknown>;
  disabled?: boolean;
}

interface UseDraggableReturn {
  // Ref setters
  setNodeRef: (element: HTMLElement | null) => void;
  setHandleRef: (element: HTMLElement | null) => void;

  // State
  isDragging: boolean;
  isPending: boolean;

  // Accessibility attributes
  attributes: {
    role: "button";
    tabIndex: number;
    "aria-pressed": boolean;
    "aria-roledescription": string;
    "aria-describedby": string;
  };

  // Event listeners (spread onto element or handle)
  listeners: {
    onPointerDown: (e: React.PointerEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };

  // Current transform (only during drag)
  transform: { x: number; y: number } | null;
}

// ============================================================
// Hook Implementation
// ============================================================
export function useDraggable({
  id,
  type,
  data = {},
  disabled = false,
}: UseDraggableConfig): UseDraggableReturn {
  const {
    state,
    registerDraggable,
    unregisterDraggable,
    startPending,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
  } = useDndContext();

  // reference to the actual DOM element that represents the draggable item
  const nodeRef = React.useRef<HTMLElement | null>(null);
  const handleRef = React.useRef<HTMLElement | null>(null);
  const originRef = React.useRef<Coordinates | null>(null);
  const isActiveRef = React.useRef(false);

  // Derived state
  const isDragging = state.status === "dragging" && state.item.id === id;
  const isPending = state.status === "pending" && state.item.id === id;

  // Transform during drag
  const transform = isDragging ? { x: state.delta.x, y: state.delta.y } : null;

  // Register on mount and when dependencies change
  React.useEffect(() => {
    if (nodeRef.current) {
      registerDraggable({
        id,
        type,
        element: nodeRef.current,
        handleElement: handleRef.current || undefined,
        data,
        disabled,
      });
    }

    return () => unregisterDraggable(id);
  }, [id, type, data, disabled, registerDraggable, unregisterDraggable]);

  // Pointer event handlers
  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      
      if (disabled || e.button !== 0) {
        return;
      }

      // Don't start drag if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (
        target.closest("button, input, textarea, select, a, [data-no-drag]")
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const origin: Coordinates = { x: e.clientX, y: e.clientY };
      originRef.current = origin;
      isActiveRef.current = false;

      // Store capture target and pointer ID for reliable release
      const captureTarget = e.target as HTMLElement;
      const pointerId = e.pointerId;

      // Capture pointer for reliable tracking
      captureTarget.setPointerCapture(pointerId);

      // Create the drag item with proper data structure
      const dragItem = {
        id,
        type,
        data: type === "card"
          ? { listId: data.listId as UniqueId, index: data.index as number }
          : { index: data.index as number },
      };

      startPending(dragItem, origin);

      // Set up move/up listeners
      const handlePointerMove = (moveEvent: PointerEvent) => {
        const current: Coordinates = {
          x: moveEvent.clientX,
          y: moveEvent.clientY,
        };

        // Check activation distance (if still pending and not yet active)
        if (!isActiveRef.current && originRef.current) {
          const dist = Math.hypot(
            current.x - originRef.current.x,
            current.y - originRef.current.y
          );

          if (dist >= ACTIVATION_DISTANCE) {
            isActiveRef.current = true;
            startDrag();
          }
        }

        // Update position if actively dragging
        if (isActiveRef.current) {
          updateDrag(current);
        }
      };

      const handlePointerUp = () => {
        // Store the active state BEFORE cleanup resets it
        const wasActive = isActiveRef.current;
        
        // Release on the ORIGINAL capture target, not the event target
        captureTarget.releasePointerCapture(pointerId);
        cleanup();

        if (wasActive) {
          endDrag();
        } else {
          cancelDrag();
        }
      };

      const handlePointerCancel = () => {
        cleanup();
        cancelDrag();
      };

      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") {
          cleanup();
          cancelDrag();
        }
      };

      const cleanup = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerCancel);
        document.removeEventListener("keydown", handleKeyDown);
        originRef.current = null;
        isActiveRef.current = false;
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerCancel);
      document.addEventListener("keydown", handleKeyDown);
    },
    [id, type, data, disabled, startPending, startDrag, updateDrag, endDrag, cancelDrag]
  );

  // Track keyboard drag position
  const keyboardPositionRef = React.useRef<Coordinates | null>(null);

  // Keyboard handler for accessibility
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      // Space or Enter to start keyboard drag mode or drop
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();

        if (isDragging) {
          // Already dragging - drop the item
          endDrag();
          keyboardPositionRef.current = null;
          return;
        }

        // Start keyboard drag
        const element = nodeRef.current;
        if (element) {
          const rect = element.getBoundingClientRect();
          const center: Coordinates = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };

          keyboardPositionRef.current = center;

          const dragItem = {
            id,
            type,
            data: type === "card"
              ? { listId: data.listId as UniqueId, index: data.index as number }
              : { index: data.index as number },
          };

          startPending(dragItem, center);
          startDrag();
        }
        return;
      }

      // Arrow keys to move during drag
      if (isDragging && keyboardPositionRef.current) {
        const MOVE_DISTANCE = 50; // pixels per key press
        let { x, y } = keyboardPositionRef.current;

        switch (e.key) {
          case "ArrowUp":
            e.preventDefault();
            y -= MOVE_DISTANCE;
            break;
          case "ArrowDown":
            e.preventDefault();
            y += MOVE_DISTANCE;
            break;
          case "ArrowLeft":
            e.preventDefault();
            x -= MOVE_DISTANCE;
            break;
          case "ArrowRight":
            e.preventDefault();
            x += MOVE_DISTANCE;
            break;
          default:
            break;
        }

        if (e.key.startsWith("Arrow")) {
          keyboardPositionRef.current = { x, y };
          updateDrag({ x, y });
        }
      }

      // Escape to cancel if dragging
      if (e.key === "Escape" && (isDragging || isPending)) {
        e.preventDefault();
        cancelDrag();
        keyboardPositionRef.current = null;
      }
    },
    [id, type, data, disabled, isDragging, isPending, startPending, startDrag, updateDrag, endDrag, cancelDrag]
  );

  // Ref setters
  const setNodeRef = React.useCallback((element: HTMLElement | null) => {
    nodeRef.current = element;
  }, []);

  const setHandleRef = React.useCallback((element: HTMLElement | null) => {
    handleRef.current = element;
  }, []);

  return {
    setNodeRef,
    setHandleRef,
    isDragging,
    isPending,
    attributes: {
      role: "button",
      tabIndex: disabled ? -1 : 0,
      "aria-pressed": isDragging,
      "aria-roledescription": `Draggable ${type}`,
      "aria-describedby": "dnd-instructions",
    },
    listeners: {
      onPointerDown: handlePointerDown,
      onKeyDown: handleKeyDown,
    },
    transform,
  };
}
