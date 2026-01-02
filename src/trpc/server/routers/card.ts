import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { board, list, card } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { uuid } from "@/lib/uuid";

// Helper function to verify board access through list
async function verifyListAccess(db: any, userId: string, listId: string) {
  const result = await db
    .select({
      listId: list.id,
      boardId: list.boardId,
      orgId: board.orgId,
    })
    .from(list)
    .innerJoin(board, eq(list.boardId, board.id))
    .where(eq(list.id, listId))
    .limit(1);

  if (result.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "List not found"
    });
  }

  // TODO: Add org-level authorization when user schema includes orgId
  // if (result[0].orgId !== userOrgId) {
  //   throw new TRPCError({
  //     code: "FORBIDDEN",
  //     message: "Access denied to this board"
  //   });
  // }

  return result[0];
}

// Helper function to verify card access
async function verifyCardAccess(db: any, userId: string, cardId: string) {
  const result = await db
    .select({
      cardId: card.id,
      listId: card.listId,
      boardId: list.boardId,
      orgId: board.orgId,
    })
    .from(card)
    .innerJoin(list, eq(card.listId, list.id))
    .innerJoin(board, eq(list.boardId, board.id))
    .where(eq(card.id, cardId))
    .limit(1);

  if (result.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Card not found"
    });
  }

  // TODO: Add org-level authorization when user schema includes orgId
  // if (result[0].orgId !== userOrgId) {
  //   throw new TRPCError({
  //     code: "FORBIDDEN",
  //     message: "Access denied to this board"
  //   });
  // }

  return result[0];
}

export const cardRouter = createTRPCRouter({
  /** Get cards for a list */
  getListCards: protectedProcedure
    .input(z.object({ listId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Verify list access
      await verifyListAccess(ctx.db, ctx.user.id, input.listId);

      try {
        const cards = await ctx.db
          .select()
          .from(card)
          .where(eq(card.listId, input.listId))
          .orderBy(asc(card.order));

        return cards;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch cards",
          cause: error
        });
      }
    }),

  /** Create a new card */
  createCard: protectedProcedure
    .input(
      z.object({
        listId: z.string().min(1),
        name: z.string().min(1, "Card name is required").max(200, "Card name too long"),
        description: z.string().max(2000, "Description too long").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify list access
      await verifyListAccess(ctx.db, ctx.user.id, input.listId);

      try {
        // Get the current max order in a transaction-safe way
        const existingCards = await ctx.db
          .select({ order: card.order })
          .from(card)
          .where(eq(card.listId, input.listId))
          .orderBy(asc(card.order));

        const maxOrder =
          existingCards.length > 0
            ? Math.max(...existingCards.map((c) => c.order))
            : -1;

        const id = uuid();

        await ctx.db.insert(card).values({
          id,
          listId: input.listId,
          name: input.name,
          description: input.description,
          order: maxOrder + 1,
        });

        return { id };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create card",
          cause: error
        });
      }
    }),

  /** Update a card */
  updateCard: protectedProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        name: z.string().min(1, "Card name is required").max(200, "Card name too long").optional(),
        description: z.string().max(2000, "Description too long").nullable().optional(),
        dueDate: z.date().nullable().optional(),
        progress: z.number().int().min(0, "Progress must be non-negative").max(100, "Progress cannot exceed 100").optional(),
        starred: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { cardId, ...updates } = input;

      // Verify card access
      await verifyCardAccess(ctx.db, ctx.user.id, cardId);

      try {
        await ctx.db
          .update(card)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(card.id, cardId));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update card",
          cause: error
        });
      }
    }),

  /** Reorder cards within a list */
  reorderCards: protectedProcedure
    .input(
      z.object({
        listId: z.string().min(1),
        startIndex: z.number().int().min(0, "Start index must be non-negative"),
        endIndex: z.number().int().min(0, "End index must be non-negative"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify list access
      await verifyListAccess(ctx.db, ctx.user.id, input.listId);

      if (input.startIndex === input.endIndex) {
        return { success: true }; // No-op
      }

      try {
        // Fetch current cards in a transaction-safe way
        const cards = await ctx.db
          .select()
          .from(card)
          .where(eq(card.listId, input.listId))
          .orderBy(asc(card.order));

        if (cards.length === 0) {
          return { success: true };
        }

        // Validate indices
        if (input.startIndex >= cards.length || input.endIndex >= cards.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid card indices"
          });
        }

        // Reorder in memory
        const [moved] = cards.splice(input.startIndex, 1);
        cards.splice(input.endIndex, 0, moved);

        // Update order values in database
        // TODO: Wrap in transaction for consistency
        await Promise.all(
          cards.map((c, index) =>
            ctx.db
              .update(card)
              .set({ order: index, updatedAt: new Date() })
              .where(eq(card.id, c.id))
          )
        );

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reorder cards",
          cause: error
        });
      }
    }),

  /** Move a card to a different list */
  moveCard: protectedProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        sourceListId: z.string().min(1),
        targetListId: z.string().min(1),
        targetIndex: z.number().int().min(0, "Target index must be non-negative"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify card access
      const cardInfo = await verifyCardAccess(ctx.db, ctx.user.id, input.cardId);
      
      // Verify source list matches
      if (cardInfo.listId !== input.sourceListId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Card is not in the specified source list"
        });
      }

      // Verify target list access
      await verifyListAccess(ctx.db, ctx.user.id, input.targetListId);

      try {
        // TODO: Wrap in transaction for consistency
        
        // Fetch source list cards
        const sourceCards = await ctx.db
          .select()
          .from(card)
          .where(eq(card.listId, input.sourceListId))
          .orderBy(asc(card.order));

        // Find and validate the card
        const cardToMove = sourceCards.find((c) => c.id === input.cardId);
        if (!cardToMove) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Card not found in source list"
          });
        }

        const filteredSource = sourceCards.filter((c) => c.id !== input.cardId);

        // Fetch target list cards
        const targetCards = await ctx.db
          .select()
          .from(card)
          .where(eq(card.listId, input.targetListId))
          .orderBy(asc(card.order));

        // Validate target index
        if (input.targetIndex > targetCards.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid target index"
          });
        }

        // Insert at target index
        targetCards.splice(input.targetIndex, 0, cardToMove);

        // Update source list orders
        await Promise.all(
          filteredSource.map((c, index) =>
            ctx.db
              .update(card)
              .set({ order: index, updatedAt: new Date() })
              .where(eq(card.id, c.id))
          )
        );

        // Update target list orders and move the card
        await Promise.all(
          targetCards.map((c, index) =>
            ctx.db
              .update(card)
              .set({
                order: index,
                listId: input.targetListId,
                updatedAt: new Date(),
              })
              .where(eq(card.id, c.id))
          )
        );

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to move card",
          cause: error
        });
      }
    }),

  /** Delete a card */
  deleteCard: protectedProcedure
    .input(z.object({ cardId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Verify card access
      await verifyCardAccess(ctx.db, ctx.user.id, input.cardId);

      try {
        await ctx.db.delete(card).where(eq(card.id, input.cardId));
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete card",
          cause: error
        });
      }
    }),

  /** Get a single card by ID */
  getCard: protectedProcedure
    .input(z.object({ cardId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Verify card access
      await verifyCardAccess(ctx.db, ctx.user.id, input.cardId);

      try {
        const cardData = await ctx.db
          .select()
          .from(card)
          .where(eq(card.id, input.cardId))
          .limit(1);

        if (cardData.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Card not found"
          });
        }

        return cardData[0];
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch card",
          cause: error
        });
      }
    }),
});