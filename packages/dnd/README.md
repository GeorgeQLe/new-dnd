# kanban-dnd

A lightweight, performant drag-and-drop library for React with ghost indicators, FLIP animations, and Kanban board support.

## Installation

```bash
npm install kanban-dnd
```

## Features

- 🎯 **Ghost Indicators** - Visual drop zones with configurable hover delays
- 🔄 **FLIP Animations** - Smooth reorder animations
- 📱 **Pointer & Keyboard Sensors** - Full accessibility support
- 🎨 **Headless** - Bring your own styles
- ⚡ **Performant** - RAF throttling, cached rects, minimal re-renders
- 📦 **Tree-shakeable** - Only import what you need
- 🔷 **TypeScript** - Full type safety

## Quick Start

```tsx
import {
  DndProvider,
  useSortable,
  useDroppable,
  useDndContext,
} from 'kanban-dnd';

function App() {
  const handleDragEnd = (item, target, position) => {
    if (item.type === 'card' && position) {
      // Reorder cards
      reorderCards(item.data.listId, position.listId, item.data.index, position.index);
    }
  };

  return (
    <DndProvider onDragEnd={handleDragEnd}>
      <KanbanBoard />
    </DndProvider>
  );
}
```

### Creating a Sortable Card

```tsx
function Card({ card, index, listId }) {
  const sortable = useSortable({
    id: card.id,
    type: 'card',
    index,
    containerId: listId,
    data: { ...card, listId, index },
  });

  return (
    <div
      ref={sortable.setNodeRef}
      style={sortable.style}
      {...sortable.attributes}
      {...sortable.listeners}
      className="p-4 bg-white rounded-lg shadow"
    >
      {card.title}
    </div>
  );
}
```

### Creating a Droppable List

```tsx
function List({ list }) {
  const droppable = useDroppable({
    id: list.id,
    type: 'list',
    accepts: ['card'],
  });

  return (
    <div
      ref={droppable.setNodeRef}
      className={cn(
        'p-4 bg-gray-100 rounded-lg min-h-[200px]',
        droppable.isOver && 'ring-2 ring-blue-500'
      )}
    >
      {list.cards.map((card, index) => (
        <Card key={card.id} card={card} index={index} listId={list.id} />
      ))}
    </div>
  );
}
```

## Advanced Usage

### Ghost Indicators for Cards

```tsx
import { useCardDragAnimation } from 'kanban-dnd';

function List({ list }) {
  const containerRef = useRef(null);
  const { state } = useDndContext();

  const cardAnimation = useCardDragAnimation({
    container: containerRef.current,
    mousePosition: getMousePosition(state),
    sourceListId: getDragSourceListId(state),
    draggedIndex: getDraggedIndex(state),
    destListId: list.id,
    cardCount: list.cards.length,
    enabled: isCardDragActive(state),
    hoverDelay: 400, // ms before showing ghost
  });

  return (
    <div ref={containerRef}>
      {cardAnimation.ghostVisible && cardAnimation.ghost?.p === 0 && (
        <GhostIndicator />
      )}
      {list.cards.map((card, index) => (
        <React.Fragment key={card.id}>
          <Card card={card} index={index} listId={list.id} />
          {cardAnimation.ghostVisible && cardAnimation.ghost?.p === index + 1 && (
            <GhostIndicator />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
```

### Ghost Indicators for Lists

```tsx
import { useListDragAnimation } from 'kanban-dnd';

function Board({ lists }) {
  const containerRef = useRef(null);

  const listAnimation = useListDragAnimation({
    container: containerRef.current,
    mousePosition,
    draggedIndex,
    listCount: lists.length,
    enabled: isListDragActive,
    hoverDelay: 400,
  });

  return (
    <div ref={containerRef} className="flex gap-4">
      {listAnimation.ghostVisible && listAnimation.ghostSlot === 'LEFT_END' && (
        <ListGhostZone />
      )}
      {lists.map((list, index) => (
        <React.Fragment key={list.id}>
          {listAnimation.ghostVisible && listAnimation.ghostSlot === index && (
            <ListGhostZone />
          )}
          <List list={list} index={index} />
        </React.Fragment>
      ))}
      {listAnimation.ghostVisible && listAnimation.ghostSlot === 'RIGHT_END' && (
        <ListGhostZone />
      )}
    </div>
  );
}
```

## API Reference

### Hooks

| Hook | Description |
|------|-------------|
| `useDraggable` | Make an element draggable |
| `useDroppable` | Make an element a drop target |
| `useSortable` | Combined draggable + droppable for sortable items |
| `useCardDragAnimation` | Card drag animations with ghost indicators |
| `useListDragAnimation` | List drag animations with ghost indicators |
| `useFLIPAnimation` | Smooth layout animations on reorder |
| `useDragOverlay` | Floating drag preview |

### Context

| Export | Description |
|--------|-------------|
| `DndProvider` | Context provider - wrap your app |
| `useDndContext` | Access current drag state |
| `useIsDragging` | Boolean helper for drag state |
| `useActiveDragItem` | Get the currently dragged item |

### Utilities

| Function | Description |
|----------|-------------|
| `reorder(list, startIndex, endIndex)` | Reorder array items |
| `moveBetweenLists(source, dest, srcIdx, destIdx)` | Move between arrays |
| `calculateNewIndex(draggedIndex, gapIndex)` | Convert gap to insertion index |

## TypeScript

Full TypeScript support with exported types:

```tsx
import type {
  DragItem,
  DropTarget,
  InsertPosition,
  CardGhost,
  CardHoverTarget,
  DragState,
} from 'kanban-dnd';
```

## License

MIT
