# List Ghost Indicator & Slide Animation - Technical Specification

## Overview

This specification defines the implementation of ghost indicators and slide animations for list dragging in the custom DnD library. The behavior mirrors the existing card ghost indicator system, adapted for horizontal list movement.

---

## 1. Ghost Indicator Behavior

### 1.1 Trigger Mechanism

- **Hover Delay**: 400ms (matches card behavior)
- **Trigger Condition**: Cursor hovering over board drop zone while dragging a list
- **Calculation Frequency**: RAF-throttled (batched to animation frames)

### 1.2 Insertion Index Calculation

```typescript
function calculateListInsertionIndex(
  mouseX: number,
  lists: Element[],
  draggedListId: string,
  draggedListIndex: number
): number | null {
  for (let i = 0; i < lists.length; i++) {
    const rect = lists[i].getBoundingClientRect();
    const midpointX = rect.left + rect.width / 2;

    if (mouseX < midpointX) {
      const insertIndex = i;

      // Skip adjacent positions (filter positions ±1 from current)
      if (Math.abs(insertIndex - draggedListIndex) <= 1) {
        return null;
      }

      return insertIndex;
    }
  }

  // Insert at end
  const insertIndex = lists.length;
  if (Math.abs(insertIndex - draggedListIndex) <= 1) {
    return null;
  }

  return insertIndex;
}
```

### 1.3 Same-Position Filtering

- Ghost is suppressed when:
  - Insertion index equals current list index
  - Insertion index is immediately adjacent (±1 position) to current index
- This prevents "no-op" visual feedback

---

## 2. Visual Design

### 2.1 Ghost Insertion Zone

The gap created between lists displays a colored highlight zone:

```css
.list-ghost-zone {
  /* Dimensions */
  width: 320px; /* Match list width */
  height: 100%;
  min-height: 200px;

  /* Background */
  background-color: rgb(219 234 254); /* blue-100 */

  /* Border */
  border: 2px dashed rgb(147 197 253); /* blue-300 */
  border-radius: 0.5rem; /* rounded-lg */

  /* Layout */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
```

### 2.2 Origin Placeholder

When a list is being dragged, its original position shows a dimmed version:

```css
.list-dragging-placeholder {
  opacity: 0.3;
  pointer-events: none;
}
```

### 2.3 Drag Overlay

The floating list that follows the cursor:

```css
.list-drag-overlay {
  position: fixed;
  z-index: 9999;
  pointer-events: none;

  /* Sizing */
  width: 320px;
  max-height: 400px;
  overflow: hidden;

  /* Visual treatment for clipped content */
  mask-image: linear-gradient(
    to bottom,
    black 0%,
    black 85%,
    transparent 100%
  );

  /* Shadow for depth */
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);

  /* Smooth movement */
  will-change: transform;
  backface-visibility: hidden;
}
```

---

## 3. Animation Specifications

### 3.1 List Displacement Animation

When lists slide to create the insertion gap:

```typescript
const DISPLACEMENT_CONFIG = {
  duration: 200, // ms
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  stagger: 0, // Simultaneous, no stagger
};
```

CSS Implementation:

```css
.list-displaced {
  transform: translateX(var(--displacement-x, 0));
  transition: transform 200ms cubic-bezier(0.2, 0, 0, 1);
}

[data-displaced="left"] {
  --displacement-x: -340px; /* List width + gap */
}

[data-displaced="right"] {
  --displacement-x: 340px; /* List width + gap */
}
```

### 3.2 FLIP Drop Animation

When the list is dropped into its final position:

```typescript
const FLIP_CONFIG = {
  duration: 200,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
};

function flipToFinalPosition(
  overlay: HTMLElement,
  finalPosition: DOMRect
): void {
  const currentRect = overlay.getBoundingClientRect();

  const deltaX = finalPosition.left - currentRect.left;
  const deltaY = finalPosition.top - currentRect.top;

  overlay.animate([
    { transform: 'translate(0, 0)' },
    { transform: `translate(${deltaX}px, ${deltaY}px)` }
  ], {
    duration: FLIP_CONFIG.duration,
    easing: FLIP_CONFIG.easing,
    fill: 'forwards'
  });
}
```

### 3.3 Cancel Animation (Escape Key)

When drag is cancelled, list returns to origin:

```typescript
function animateToOrigin(
  overlay: HTMLElement,
  originPosition: DOMRect
): Promise<void> {
  const currentRect = overlay.getBoundingClientRect();

  const deltaX = originPosition.left - currentRect.left;
  const deltaY = originPosition.top - currentRect.top;

  return overlay.animate([
    { transform: 'translate(0, 0)' },
    { transform: `translate(${deltaX}px, ${deltaY}px)` }
  ], {
    duration: 200,
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
    fill: 'forwards'
  }).finished;
}
```

---

## 4. Type Definitions

### 4.1 Extended DnD Types

```typescript
// Add to core/types.ts

export type GhostAxis = 'vertical' | 'horizontal';

export interface ListInsertPosition {
  boardId: UniqueId;
  index: number;
}

// Extend DragStateDragging
export interface DragStateDragging {
  status: 'dragging';
  item: DragItem;
  origin: Coordinates;
  current: Coordinates;
  delta: Coordinates;
  over: DropTarget | null;

  // Card ghost (existing)
  insertPosition: InsertPosition | null;
  ghostIndicatorVisible: boolean;
  ghostInsertionIndex: number | null;

  // List ghost (new)
  listInsertPosition: ListInsertPosition | null;
  listGhostIndicatorVisible: boolean;
  listGhostInsertionIndex: number | null;
}

export interface GhostTriggerOptions {
  containerId: UniqueId;
  axis: GhostAxis;
  itemId: UniqueId;
  itemIndex: number;
  delay?: number; // Default: 400ms
  skipAdjacentPositions?: boolean; // Default: true for lists
}
```

### 4.2 Hook Return Types

```typescript
export interface UseGhostTriggerReturn {
  ghostVisible: boolean;
  ghostInsertionIndex: number | null;
  resetGhost: () => void;
}

export interface UseListSortableReturn {
  // Drag state
  isDragging: boolean;
  isPending: boolean;

  // Refs and handlers
  setNodeRef: (node: HTMLElement | null) => void;
  setDragHandleRef: (node: HTMLElement | null) => void;

  // Attributes
  attributes: DragAttributes;
  listeners: DragListeners;
  dragHandleListeners: DragListeners;

  // Styling
  style: React.CSSProperties;
  placeholderStyle: React.CSSProperties;

  // Ghost state
  isOver: boolean;
  ghostPosition: ListInsertPosition | null;
}
```

---

## 5. Hook API

### 5.1 Extended useGhostTrigger

```typescript
function useGhostTrigger(options: GhostTriggerOptions): UseGhostTriggerReturn {
  const {
    containerId,
    axis,
    itemId,
    itemIndex,
    delay = 400,
    skipAdjacentPositions = axis === 'horizontal',
  } = options;

  // Implementation handles both vertical (cards) and horizontal (lists)
  // Axis determines:
  // - Which coordinate to use (Y for vertical, X for horizontal)
  // - Which dimension for midpoint (height for vertical, width for horizontal)
  // - Direction of displacement (up/down for vertical, left/right for horizontal)
}
```

### 5.2 useListSortable Hook

```typescript
function useListSortable(options: {
  id: UniqueId;
  index: number;
  boardId: UniqueId;
  data?: Record<string, unknown>;
}): UseListSortableReturn {
  // Combines:
  // - useDraggable for drag initiation (header only)
  // - useDroppable for drop target
  // - useGhostTrigger for ghost calculation
  // - Displacement management
}
```

---

## 6. Component Structure

### 6.1 ListGhostIndicator Component

```typescript
interface ListGhostIndicatorProps {
  insertionIndex: number;
  boardId: string;
  listWidth?: number;
}

function ListGhostIndicator({
  insertionIndex,
  boardId,
  listWidth = 320,
}: ListGhostIndicatorProps): JSX.Element | null {
  // Renders the blue highlight zone at the insertion position
  // Positioned absolutely or via flexbox gap
}
```

### 6.2 KanbanList Integration

```typescript
function KanbanList({ list, index, boardId }: KanbanListProps) {
  const {
    isDragging,
    setNodeRef,
    setDragHandleRef,
    attributes,
    dragHandleListeners,
    style,
    placeholderStyle,
  } = useListSortable({
    id: list.id,
    index,
    boardId,
    data: list,
  });

  const { state } = useDndContext();
  const isListDragActive = state.status === 'dragging' &&
                           state.item.type === 'list';

  // Disable card interactions when any list is being dragged
  const cardInteractionsDisabled = isListDragActive;

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? placeholderStyle : style}
      className={cn(
        'kanban-list',
        isDragging && 'list-dragging-placeholder'
      )}
    >
      {/* Header with drag handle */}
      <div
        ref={setDragHandleRef}
        {...attributes}
        {...dragHandleListeners}
        className="list-header cursor-grab active:cursor-grabbing"
      >
        <h3>{list.name}</h3>
      </div>

      {/* Cards - interactions disabled during list drag */}
      <div className="list-cards">
        {list.cards.map((card, cardIndex) => (
          <KanbanCard
            key={card.id}
            card={card}
            index={cardIndex}
            listId={list.id}
            disabled={cardInteractionsDisabled}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 7. State Machine Extensions

### 7.1 Context Actions

```typescript
type DndAction =
  // Existing actions...
  | { type: 'SET_LIST_GHOST_VISIBLE'; visible: boolean }
  | { type: 'SET_LIST_GHOST_INSERTION_INDEX'; index: number | null }
  | { type: 'SET_LIST_INSERT_POSITION'; position: ListInsertPosition | null };
```

### 7.2 State Transitions

```
List Drag Flow:
1. IDLE → pointerdown on list header
2. → PENDING (150ms activation delay)
3. → DRAGGING (distance threshold met)
   - listGhostIndicatorVisible: false
   - listGhostInsertionIndex: null
4. → Cursor enters board area
5. → 400ms hover delay passes
6. → listGhostIndicatorVisible: true
7. → listGhostInsertionIndex: calculated
8. → Drop or Escape
9. → ENDING (FLIP animation)
10. → IDLE
```

---

## 8. Keyboard Accessibility

### 8.1 Key Bindings (Match Card Behavior)

When list is focused and dragging:

| Key | Action |
|-----|--------|
| Space/Enter | Initiate drag mode |
| Left Arrow | Move list one position left |
| Right Arrow | Move list one position right |
| Escape | Cancel drag, return to origin |
| Space/Enter | Confirm drop at current position |

### 8.2 Focus Management

- Tab order includes list headers
- Focus ring visible on list header
- Screen reader announcements for:
  - Drag start: "Grabbed list {name}, position {n} of {total}"
  - Position change: "Moved to position {n} of {total}"
  - Drop: "Dropped list {name} at position {n}"
  - Cancel: "Drop cancelled, returned to original position"

---

## 9. Performance Considerations

### 9.1 RAF Throttling

```typescript
const scheduleGhostCalculation = rafThrottle((mouseX: number) => {
  const index = calculateListInsertionIndex(mouseX, lists, draggedId, currentIndex);
  if (index !== currentGhostIndex) {
    dispatch({ type: 'SET_LIST_GHOST_INSERTION_INDEX', index });
  }
});
```

### 9.2 Cached Measurements

- List rects cached and invalidated on:
  - Scroll events
  - Resize events
  - List count changes
- Cache TTL: 100ms

### 9.3 GPU Acceleration

```css
.list-in-drag {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}
```

---

## 10. Touch Device Support

### 10.1 Activation

- **Delay**: 150ms (matches desktop)
- **Distance Threshold**: 10px
- **touch-action**: Set to `none` on list header during drag

### 10.2 Scroll Prevention

```typescript
function onTouchStart(e: TouchEvent) {
  if (isListHeader(e.target)) {
    // Start activation timer
    activationTimer = setTimeout(() => {
      // Prevent scroll, initiate drag
      document.body.style.touchAction = 'none';
      startDrag(e);
    }, 150);
  }
}
```

---

## 11. Edge Cases

### 11.1 Single List Board

- Ghost system still active
- Only "no valid drop position" state possible
- User can still pick up and drop back

### 11.2 Two List Board

- With adjacent filtering enabled, limited ghost positions
- If at position 0, can only ghost at position 2 (after last)
- If at position 1, can only ghost at position 0 (before first)

### 11.3 Rapid Mouse Movement

- RAF throttling prevents calculation spam
- Ghost state persists during rapid movement
- Reset only on explicit exit or delay expiration

### 11.4 Browser Resize During Drag

- Cached rects invalidated on resize
- Positions recalculated next animation frame
- Overlay position updated via CSS custom properties

---

## 12. Files to Modify

| File | Changes |
|------|---------|
| `src/lib/dnd/core/types.ts` | Add list ghost types, GhostAxis, ListInsertPosition |
| `src/lib/dnd/core/context.tsx` | Add list ghost state fields and actions |
| `src/lib/dnd/hooks/use-ghost-trigger.ts` | Add axis parameter, horizontal calculation |
| `src/lib/dnd/hooks/use-smart-displacement.ts` | Add horizontal displacement |
| `src/lib/dnd/hooks/use-list-sortable.ts` | New hook combining drag + ghost for lists |
| `src/lib/dnd/components/list-ghost-indicator.tsx` | New component for ghost zone |
| `src/components/kanban/kanban-list.tsx` | Integrate list dragging |
| `src/components/kanban/kanban-board.tsx` | Render ghost indicator, handle drops |
