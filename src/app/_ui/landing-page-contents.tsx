"use client";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const LandingPageContents = () => {

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full gap-4">
      <h1 className="text-3xl font-bold">Kanban DnD Library</h1>
      <p className="text-muted-foreground">A custom drag-and-drop library for kanban boards</p>
      <div className="flex gap-4">
        <Link href="/demo">
          <Button variant="default">
            Try Demo (No Login)
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="outline">
            Login
          </Button>
        </Link>
      </div>
    </div>
  );
};