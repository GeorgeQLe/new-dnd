# kanban-dnd

A custom drag-and-drop library for React with ghost indicators, FLIP animations, and Kanban board support.

## Packages

- **`packages/dnd`** - The core drag-and-drop library
- **`example-dnd-app`** - Next.js example application demonstrating the library

## Features

- 🎯 **Ghost Indicators** - Visual drop zones with configurable delays
- 🔄 **FLIP Animations** - Smooth reorder animations
- 📱 **Pointer & Keyboard Sensors** - Full accessibility support
- 🎨 **Customizable** - Bring your own styles
- ⚡ **Performant** - RAF throttling, cached rects, minimal re-renders
- 📦 **Tree-shakeable** - Only import what you need

## Quick Start

### Installation

```bash
npm install kanban-dnd
```

### Basic Usage

```tsx
import {
  DndProvider,
  useSortable,
  useDroppable
} from 'kanban-dnd';

function App() {
  const handleDragEnd = (item, target, position) => {
    // Handle reorder logic
  };

  return (
    <DndProvider onDragEnd={handleDragEnd}>
      <Board />
    </DndProvider>
  );
}

function Card({ card, index, listId }) {
  const sortable = useSortable({
    id: card.id,
    type: 'card',
    index,
    containerId: listId,
    data: card,
  });

  return (
    <div
      ref={sortable.setNodeRef}
      style={sortable.style}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      {card.title}
    </div>
  );
}
```

## Development

```bash
# Install dependencies
npm install

# Run the example app
npm run dev

# Build the library
npm run build

# Type check
npm run typecheck
```

## API Reference

### Hooks

- `useDraggable` - Make an element draggable
- `useDroppable` - Make an element a drop target
- `useSortable` - Combined draggable + droppable for sortable lists
- `useListDragAnimation` - List drag animations with ghost indicators
- `useCardDragAnimation` - Card drag animations with ghost indicators
- `useFLIPAnimation` - Smooth reorder animations
- `useDragOverlay` - Floating drag preview

### Context

- `DndProvider` - Wrap your app to enable drag-and-drop
- `useDndContext` - Access drag state

### Utilities

- `reorder` - Reorder array items
- `moveBetweenLists` - Move items between lists
- `calculateNewIndex` - Convert gap position to insertion index

## License

MIT
