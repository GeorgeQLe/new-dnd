"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reorder, moveBetweenLists } from "@/lib/dnd";
import type { ListWithCards, Card } from "@/db/schema";

// ============================================================
// Types for the hook
// ============================================================
interface UseKanbanOptions {
  /** Initial lists data */
  initialData?: ListWithCards[];
  /** Callback when lists are reordered - implement your own persistence */
  onListReorder?: (boardId: string, startIndex: number, endIndex: number) => Promise<void>;
  /** Callback when cards are reordered - implement your own persistence */
  onCardReorder?: (listId: string, startIndex: number, endIndex: number) => Promise<void>;
  /** Callback when a card moves between lists - implement your own persistence */
  onCardMove?: (cardId: string, sourceListId: string, targetListId: string, targetIndex: number) => Promise<void>;
}

// ============================================================
// Hook Implementation
// ============================================================
export function useKanban(boardId: string, options: UseKanbanOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = ["list", "getBoardLists", { boardId }];

  // Local state for lists
  const [lists, setLists] = React.useState<ListWithCards[]>(options.initialData ?? []);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  // Mutation states
  const [isReorderingLists, setIsReorderingLists] = React.useState(false);
  const [isReorderingCards, setIsReorderingCards] = React.useState(false);
  const [isMovingCard, setIsMovingCard] = React.useState(false);

  // ============================================================
  // Reorder Lists
  // ============================================================
  const handleListReorder = React.useCallback(
    async (startIndex: number, endIndex: number) => {
      if (startIndex === endIndex) return;

      // Optimistically update
      const previousLists = lists;
      const newLists = reorder(lists, startIndex, endIndex).map((list, index) => ({
        ...list,
        order: index,
      }));
      setLists(newLists);
      setIsReorderingLists(true);

      try {
        if (options.onListReorder) {
          await options.onListReorder(boardId, startIndex, endIndex);
        }
      } catch (err) {
        // Rollback on error
        setLists(previousLists);
        toast.error("Failed to reorder lists");
      } finally {
        setIsReorderingLists(false);
      }
    },
    [boardId, lists, options]
  );

  // ============================================================
  // Reorder Cards
  // ============================================================
  const handleCardReorder = React.useCallback(
    async (listId: string, startIndex: number, endIndex: number) => {
      if (startIndex === endIndex) return;

      // Optimistically update
      const previousLists = lists;
      const newLists = lists.map((list) => {
        if (list.id !== listId) return list;
        const newCards = reorder(list.cards, startIndex, endIndex).map((card, index) => ({
          ...card,
          order: index,
        }));
        return { ...list, cards: newCards };
      });
      setLists(newLists);
      setIsReorderingCards(true);

      try {
        if (options.onCardReorder) {
          await options.onCardReorder(listId, startIndex, endIndex);
        }
      } catch (err) {
        // Rollback on error
        setLists(previousLists);
        toast.error("Failed to reorder cards");
      } finally {
        setIsReorderingCards(false);
      }
    },
    [lists, options]
  );

  // ============================================================
  // Move Card Between Lists
  // ============================================================
  const handleCardMove = React.useCallback(
    async (
      cardId: string,
      sourceListId: string,
      targetListId: string,
      targetIndex: number
    ) => {
      // Optimistically update
      const previousLists = lists;

      const sourceListIndex = lists.findIndex((l) => l.id === sourceListId);
      const targetListIndex = lists.findIndex((l) => l.id === targetListId);

      if (sourceListIndex === -1 || targetListIndex === -1) return;

      const sourceList = lists[sourceListIndex];
      const targetList = lists[targetListIndex];

      const cardIndex = sourceList.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return;

      const { source: newSourceCards, destination: newTargetCards } =
        moveBetweenLists(sourceList.cards, targetList.cards, cardIndex, targetIndex);

      // Update listId on moved card
      const movedCard = newTargetCards.find((c) => c.id === cardId);
      if (movedCard) {
        (movedCard as Card).listId = targetListId;
      }

      const newLists = [...lists];
      newLists[sourceListIndex] = {
        ...sourceList,
        cards: newSourceCards.map((c, i) => ({ ...c, order: i })),
      };
      newLists[targetListIndex] = {
        ...targetList,
        cards: newTargetCards.map((c, i) => ({ ...c, order: i })),
      };

      setLists(newLists);
      setIsMovingCard(true);

      try {
        if (options.onCardMove) {
          await options.onCardMove(cardId, sourceListId, targetListId, targetIndex);
        }
      } catch (err) {
        // Rollback on error
        setLists(previousLists);
        toast.error("Failed to move card");
      } finally {
        setIsMovingCard(false);
      }
    },
    [lists, options]
  );

  // ============================================================
  // Set Lists (for external data loading)
  // ============================================================
  const setListsData = React.useCallback((newLists: ListWithCards[]) => {
    setLists(newLists);
  }, []);

  return {
    // Data
    lists,
    isLoading,
    error,
    setLists: setListsData,

    // Mutation states
    isReorderingLists,
    isReorderingCards,
    isMovingCard,
    isMutating: isReorderingLists || isReorderingCards || isMovingCard,

    // Handlers for KanbanBoard
    onListReorder: handleListReorder,
    onCardReorder: handleCardReorder,
    onCardMove: handleCardMove,
  };
}

// ============================================================
// Simple hook for controlled mode
// ============================================================
export function useKanbanControlled(lists: ListWithCards[]) {
  const [localLists, setLocalLists] = React.useState(lists);

  // Sync with external lists
  React.useEffect(() => {
    setLocalLists(lists);
  }, [lists]);

  const handleListReorder = React.useCallback(
    (startIndex: number, endIndex: number) => {
      setLocalLists((prev) =>
        reorder(prev, startIndex, endIndex).map((list, index) => ({
          ...list,
          order: index,
        }))
      );
    },
    []
  );

  const handleCardReorder = React.useCallback(
    (listId: string, startIndex: number, endIndex: number) => {
      setLocalLists((prev) =>
        prev.map((list) => {
          if (list.id !== listId) return list;
          const newCards = reorder(list.cards, startIndex, endIndex).map((card, index) => ({
            ...card,
            order: index,
          }));
          return { ...list, cards: newCards };
        })
      );
    },
    []
  );

  const handleCardMove = React.useCallback(
    (cardId: string, sourceListId: string, targetListId: string, targetIndex: number) => {
      setLocalLists((prev) => {
        const sourceListIndex = prev.findIndex((l) => l.id === sourceListId);
        const targetListIndex = prev.findIndex((l) => l.id === targetListId);

        if (sourceListIndex === -1 || targetListIndex === -1) return prev;

        const sourceList = prev[sourceListIndex];
        const targetList = prev[targetListIndex];

        const cardIndex = sourceList.cards.findIndex((c) => c.id === cardId);
        if (cardIndex === -1) return prev;

        const { source: newSourceCards, destination: newTargetCards } =
          moveBetweenLists(sourceList.cards, targetList.cards, cardIndex, targetIndex);

        const movedCard = newTargetCards.find((c) => c.id === cardId);
        if (movedCard) {
          (movedCard as Card).listId = targetListId;
        }

        const newLists = [...prev];
        newLists[sourceListIndex] = {
          ...sourceList,
          cards: newSourceCards.map((c, i) => ({ ...c, order: i })),
        };
        newLists[targetListIndex] = {
          ...targetList,
          cards: newTargetCards.map((c, i) => ({ ...c, order: i })),
        };

        return newLists;
      });
    },
    []
  );

  return {
    lists: localLists,
    onListReorder: handleListReorder,
    onCardReorder: handleCardReorder,
    onCardMove: handleCardMove,
  };
}
