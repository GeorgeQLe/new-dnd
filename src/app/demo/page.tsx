"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { KanbanBoard } from "@/components/kanban/board";
import { useKanbanControlled } from "@/hooks/use-kanban";
import { Button } from "@/components/ui/button";
import type { ListWithCards } from "@/db/schema";

// ============================================================
// Mock Data for Demo
// ============================================================
const MOCK_LISTS: ListWithCards[] = [
  {
    id: "list-1",
    boardId: "demo-board",
    name: "To Do",
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    cards: [
      {
        id: "card-1",
        listId: "list-1",
        name: "Research competitors",
        description: "Analyze top 5 competitors in the market",
        order: 0,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        progress: 0,
        starred: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "card-2",
        listId: "list-1",
        name: "Design wireframes",
        description: "Create low-fidelity wireframes for main screens",
        order: 1,
        dueDate: null,
        progress: 0,
        starred: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "card-3",
        listId: "list-1",
        name: "Setup project repository",
        description: null,
        order: 2,
        dueDate: null,
        progress: 0,
        starred: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
  {
    id: "list-2",
    boardId: "demo-board",
    name: "In Progress",
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    cards: [
      {
        id: "card-4",
        listId: "list-2",
        name: "Implement authentication",
        description: "Add OAuth with Google and GitHub",
        order: 0,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        progress: 60,
        starred: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "card-5",
        listId: "list-2",
        name: "Build API endpoints",
        description: "REST API for CRUD operations",
        order: 1,
        dueDate: null,
        progress: 30,
        starred: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
  {
    id: "list-3",
    boardId: "demo-board",
    name: "Review",
    order: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    cards: [
      {
        id: "card-6",
        listId: "list-3",
        name: "Code review: User module",
        description: "Review PR #42 for user management",
        order: 0,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        progress: 80,
        starred: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
  {
    id: "list-4",
    boardId: "demo-board",
    name: "Done",
    order: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    cards: [
      {
        id: "card-7",
        listId: "list-4",
        name: "Project kickoff meeting",
        description: "Initial planning and team alignment",
        order: 0,
        dueDate: null,
        progress: 100,
        starred: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "card-8",
        listId: "list-4",
        name: "Setup development environment",
        description: null,
        order: 1,
        dueDate: null,
        progress: 100,
        starred: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
];

// ============================================================
// Demo Page Component
// ============================================================
export default function DemoPage() {
  const { lists, onListReorder, onCardReorder, onCardMove } =
    useKanbanControlled(MOCK_LISTS);
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Kanban Board Demo</h1>
              <p className="text-sm text-muted-foreground">
                Drag and drop cards between lists. Try keyboard navigation with
                Space/Enter and arrow keys.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                No login required
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <main className="container mx-auto">
        <KanbanBoard
          lists={lists}
          onListReorder={onListReorder}
          onCardReorder={onCardReorder}
          onCardMove={onCardMove}
        />
      </main>

      {/* Footer with instructions */}
      <footer className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur border-t p-4">
        <div className="container mx-auto">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                Click + Drag
              </kbd>{" "}
              Move cards/lists
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                Space
              </kbd>{" "}
              Pick up / Drop
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                Arrow Keys
              </kbd>{" "}
              Move while dragging
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                Esc
              </kbd>{" "}
              Cancel drag
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
