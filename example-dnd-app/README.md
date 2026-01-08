# Custom DnD Library with Advanced Ghost Indicators

A sophisticated drag-and-drop library built on React with intelligent ghost indicators, smart displacement animations, and precise same-list reordering validation.

## 🎯 Key Features

### ✨ **Advanced Ghost Indicators**
- **Smart Position Detection**: Detects insertion zones with displacement-aware calculations
- **Same-List Validation**: Prevents meaningless adjacent moves while allowing valid reordering
- **Dynamic State Management**: Ghost indicators appear/disappear based on precise timer and position logic
- **Cross-List Support**: Seamless dragging between different containers

### 🎬 **FLIP Animations** 
- **Smooth Reordering**: Cards animate smoothly between positions during reordering
- **Smart Displacement**: Cards intelligently move out of the way to show insertion previews
- **Performance Optimized**: Uses requestAnimationFrame and optimized re-render prevention

### 🏗️ **Architecture**
- **Custom Hook System**: Modular hooks for draggable, droppable, sortable, and ghost behaviors
- **Context-Based State**: Centralized drag state management with React Context
- **TypeScript**: Fully typed with comprehensive interface definitions
- **React 19 Compatible**: Built for modern React with concurrent features

## 🚀 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with React 19
- **DnD Engine**: Custom built drag-and-drop system
- **API Layer**: [tRPC](https://trpc.io) for end-to-end typesafe APIs
- **Database**: NeonDB (Serverless Postgres) with Drizzle ORM
- **Authentication**: [Better Auth](https://www.better-auth.com/) with GitHub and Google OAuth providers
- **State Management**: TanStack Query (React Query) with tRPC integration
- **Type Safety**: TypeScript
- **UI Components**:
  - Radix UI primitives
  - Tailwind CSS for styling
  - shadcn/ui component library
  - Custom Kanban components

## 🛠️ Getting Started

1. Clone this repository:
```bash
git clone <your-repo-url>
cd <repo-name>
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up your environment variables:
Create a `.env` file in the root directory with the following variables:
```env
DATABASE_URL=your_neon_db_connection_string
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📚 Project Structure

```
├── src/
│   ├── app/
│   │   └── demo/          # Kanban demo implementation
│   ├── components/
│   │   ├── kanban/        # Kanban board components
│   │   │   ├── board.tsx  # Main board container
│   │   │   ├── list.tsx   # Droppable list with ghost indicators
│   │   │   ├── card.tsx   # Draggable card component
│   │   │   └── index.ts   # Component exports
│   │   ├── auth/          # Authentication components
│   │   └── ui/            # shadcn/ui components
│   ├── lib/
│   │   └── dnd/           # 🎯 Custom DnD Library
│   │       ├── core/      # Core DnD engine
│   │       │   ├── context.tsx      # Drag state management
│   │       │   ├── types.ts         # TypeScript definitions
│   │       │   ├── utils.ts         # Collision detection & positioning
│   │       │   └── constants.ts     # Animation & timing constants
│   │       ├── hooks/     # Drag & Drop hooks
│   │       │   ├── use-draggable.ts     # Make elements draggable
│   │       │   ├── use-droppable.ts     # Make containers droppable
│   │       │   ├── use-sortable.ts      # Combined drag & drop
│   │       │   ├── use-ghost-trigger.ts # ✨ Ghost indicator logic
│   │       │   ├── use-smart-displacement.ts # Smart animations
│   │       │   └── use-flip-animation.ts # FLIP animations
│   │       ├── sensors/   # Input handling
│   │       │   ├── pointer-sensor.ts   # Mouse/touch input
│   │       │   └── keyboard-sensor.ts  # Keyboard navigation
│   │       └── index.ts   # Library exports
│   ├── db/                # Database schema and connection
│   ├── hooks/             # App-specific React hooks
│   ├── providers/         # React context providers
│   └── trpc/              # tRPC client and server setup
├── drizzle/               # Database migrations and metadata
└── package.json           # Project dependencies and scripts
```

## 🎯 DnD Library Usage

### Basic Implementation

```tsx
import { DndProvider, useSortable, useDroppable } from '@/lib/dnd';

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
    <div ref={droppable.setNodeRef}>
      {list.cards.map((card, index) => (
        <KanbanCard key={card.id} card={card} index={index} listId={list.id} />
      ))}
    </div>
  );
}
```

### Ghost Indicator Features

- **Smart Position Detection**: Automatically detects valid insertion zones
- **Same-List Validation**: Prevents adjacent position moves that don't change order
- **Timer-Based Triggering**: 400ms delay before ghost indicators appear
- **Dynamic State Management**: Ghosts disappear when moving to invalid positions

## 🎥 YouTube Walkthroughs

This project is part of the G Can Build YouTube channel series focused on building advanced drag-and-drop interfaces.

Topics covered:
- Custom DnD library architecture
- Advanced ghost indicator systems  
- FLIP animations and performance optimization
- Same-list reordering validation logic
- TypeScript patterns for drag-and-drop
- React 19 concurrent features integration

## 📦 Recent Accomplishments

### ✅ **Ghost Indicator System (Dec 2024)**
- **Fixed same-list ghost positioning** with precise empty space zone detection
- **Implemented dynamic state management** for smooth ghost transitions between positions
- **Added position change detection** to properly hide/show ghosts during drag operations
- **Optimized performance** by eliminating infinite re-renders and excessive logging

### 🔄 **Next: List-to-List Ghost Indicators**
- Extend ghost system to handle list reordering with similar precision
- Implement board-level displacement animations
- Add keyboard navigation support

## 🤝 Contributing

Feel free to use this template for your own projects or contribute improvements. Issues and pull requests are welcome!

## 📝 License

This project is open source and available under the MIT license.

---

Built with ❤️ by G Can Build
