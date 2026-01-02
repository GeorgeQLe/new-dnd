# Claude Context & Development Guidelines

## Project Overview

This is a **custom drag-and-drop library** built for Kanban boards using React 19, Next.js 15, and TypeScript. The project features an advanced ghost indicator system with intelligent same-list validation and smooth FLIP animations.

## Key Commands

### Development
```bash
# Start development server
npm run dev
# or
pnpm dev

# Build for production
npm run build

# Type checking
npm run typecheck

# Linting (run after code changes)
npm run lint
npm run lint:fix
```

### Database
```bash
# Generate database migrations
npx drizzle-kit generate

# Push schema changes to database
npx drizzle-kit push

# Open Drizzle Studio (database GUI)
npx drizzle-kit studio
```

## Architecture & Best Practices

### Next.js 15 + React 19 Patterns

#### Server Components (Default)
```typescript
// app/page.tsx - Server component by default
export default async function HomePage() {
  // Can directly fetch data, use async/await
  const data = await fetchData();
  
  return (
    <div>
      <ClientComponent data={data} />
    </div>
  );
}
```

#### Client Components
```typescript
// Always add "use client" at the top for interactive components
"use client";

import { useState } from "react";

export function InteractiveComponent() {
  const [state, setState] = useState(false);
  
  return (
    <button onClick={() => setState(!state)}>
      Toggle: {state ? "On" : "Off"}
    </button>
  );
}
```

### Custom DnD Library Usage

#### Basic Implementation
```typescript
"use client";

import { DndProvider, useSortable, useDroppable } from "@/lib/dnd";

function KanbanCard({ card, index, listId }) {
  const sortable = useSortable({
    id: card.id,
    type: "card",
    index,
    containerId: listId,
    data: card
  });

  return (
    <div
      ref={sortable.setNodeRef}
      style={sortable.style}
      {...sortable.attributes}
      {...sortable.listeners}
      className="bg-white p-3 rounded-lg shadow-sm border"
    >
      {card.name}
    </div>
  );
}

function KanbanList({ list }) {
  const droppable = useDroppable({
    id: list.id,
    type: "list",
    accepts: ["card"]
  });

  return (
    <div 
      ref={droppable.setNodeRef}
      className="bg-gray-50 p-3 rounded-lg min-h-32"
    >
      {list.cards.map((card, index) => (
        <KanbanCard 
          key={card.id} 
          card={card} 
          index={index} 
          listId={list.id} 
        />
      ))}
    </div>
  );
}

// Always wrap in DndProvider
export default function Board() {
  return (
    <DndProvider>
      {/* Your kanban components */}
    </DndProvider>
  );
}
```

### tRPC Best Practices

#### Router Definition
```typescript
// src/trpc/server/routers/card.ts
export const cardRouter = createTRPCRouter({
  move: protectedProcedure
    .input(z.object({
      cardId: z.string(),
      sourceListId: z.string(),
      targetListId: z.string(),
      targetIndex: z.number()
    }))
    .mutation(async ({ input, ctx }) => {
      // Database operations
      return await ctx.db.update(cards)
        .set({ listId: input.targetListId, order: input.targetIndex })
        .where(eq(cards.id, input.cardId));
    })
});
```

#### Client Usage with Optimistic Updates
```typescript
"use client";

const utils = trpc.useUtils();

const moveCardMutation = trpc.card.move.useMutation({
  onMutate: async (variables) => {
    // Cancel outgoing refetches
    await utils.board.getWithLists.cancel();
    
    // Snapshot previous value
    const previousData = utils.board.getWithLists.getData({ boardId });
    
    // Optimistically update
    utils.board.getWithLists.setData({ boardId }, (old) => {
      if (!old) return old;
      // Apply optimistic update logic
      return updatedData;
    });
    
    return { previousData };
  },
  
  onError: (err, variables, context) => {
    // Rollback on error
    if (context?.previousData) {
      utils.board.getWithLists.setData({ boardId }, context.previousData);
    }
    toast.error("Failed to move card");
  },
  
  onSettled: () => {
    // Refetch to ensure consistency
    utils.board.getWithLists.invalidate({ boardId });
  }
});
```

### Styling Guidelines

#### Tailwind CSS Classes
```typescript
// Use consistent spacing and sizing
const cardClasses = cn(
  "bg-white p-3 rounded-lg shadow-sm border",
  "transition-all duration-200 hover:shadow-md",
  "cursor-grab active:cursor-grabbing",
  isDragging && "opacity-50",
  className
);

// Animation classes for DnD
const ghostClasses = cn(
  "opacity-60 border-2 border-dashed border-blue-500",
  "bg-blue-50 pointer-events-none"
);
```

#### CSS Custom Properties
```css
/* For drag overlays and animations */
.drag-overlay {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  transform: translate3d(var(--x), var(--y), 0) scale(1.02);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
  transition: box-shadow 200ms ease;
}
```

### Database Schema (Drizzle)

```typescript
// src/db/schema.ts
export const boards = pgTable("boards", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const lists = pgTable("lists", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  boardId: text("board_id").references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const cards = pgTable("cards", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  listId: text("list_id").references(() => lists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
```

### Performance Guidelines

#### React 19 Optimizations
```typescript
// Use React.memo for expensive components
const KanbanCard = React.memo(function KanbanCard({ card, index, listId }) {
  // Component logic
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-renders
  return prevProps.card.id === nextProps.card.id &&
         prevProps.index === nextProps.index;
});

// Use useMemo for expensive calculations
const sortedCards = useMemo(() => 
  cards.sort((a, b) => a.order - b.order),
  [cards]
);

// Use useCallback for stable references
const handleCardMove = useCallback((cardId, sourceListId, targetListId, targetIndex) => {
  moveCardMutation.mutate({ cardId, sourceListId, targetListId, targetIndex });
}, [moveCardMutation]);
```

#### DnD Performance Tips
```typescript
// Minimize re-renders during drag operations
const { state } = useDndContext();
const isDragging = useMemo(() => 
  state.status === "dragging",
  [state.status]
);

// Use stable IDs for better React reconciliation
const cardId = useMemo(() => `card-${card.id}`, [card.id]);

// RAF throttling for position updates
const throttledUpdate = useMemo(() =>
  rafThrottle((position) => updatePosition(position)),
  []
);
```

## File Structure Guidelines

```
src/
├── app/                    # Next.js app router
│   ├── demo/              # Demo pages
│   ├── api/               # API routes
│   └── globals.css        # Global styles
├── components/
│   ├── kanban/            # DnD kanban components
│   ├── ui/                # Reusable UI components (shadcn/ui)
│   └── auth/              # Authentication components  
├── lib/
│   ├── dnd/               # 🎯 Custom DnD library
│   ├── auth.ts            # Auth configuration
│   ├── utils.ts           # Utility functions
│   └── uuid.ts            # ID generation
├── db/
│   ├── schema.ts          # Drizzle database schema
│   └── index.ts           # Database connection
├── trpc/
│   ├── server/            # tRPC server setup
│   └── client/            # tRPC client setup
└── hooks/                 # App-specific React hooks
```

## Common Patterns

### Error Handling
```typescript
// tRPC error handling
const { data, isLoading, error } = trpc.board.getWithLists.useQuery(
  { boardId },
  {
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  }
);

if (error) {
  return <ErrorComponent message={error.message} />;
}
```

### Loading States
```typescript
// Consistent loading patterns
if (isLoading) {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
```

### Environment Variables
```env
# .env.local
DATABASE_URL=postgresql://...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Testing Commands
```bash
# Run type checking before commits
npm run typecheck

# Run linting
npm run lint

# Build and check for errors
npm run build
```

## Debugging Tips

### DnD Debugging
```typescript
// Temporarily enable logging for DnD issues
const { state } = useDndContext();
console.log("[DND-DEBUG]", { 
  status: state.status, 
  item: state.status === "dragging" ? state.item : null 
});
```

### Performance Debugging
```typescript
// Use React DevTools Profiler
// Enable in development with:
import { Profiler } from "react";

<Profiler id="kanban-board" onRender={(id, phase, actualDuration) => {
  console.log({ id, phase, actualDuration });
}}>
  <KanbanBoard />
</Profiler>
```

## Deployment Notes

- **Database**: Uses NeonDB (serverless Postgres)
- **Auth**: Better Auth with GitHub/Google OAuth
- **Hosting**: Optimized for Vercel deployment
- **Environment**: Ensure all env vars are set in production

---

## Quick Reference

- **Demo URL**: `/demo` - Working Kanban implementation
- **Main DnD Library**: `src/lib/dnd/` - Complete custom implementation
- **Ghost Indicators**: Advanced positioning with same-list validation
- **Performance**: 60fps with RAF throttling and optimized re-renders
- **TypeScript**: Full type safety throughout the codebase