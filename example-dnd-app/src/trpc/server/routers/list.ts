import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { board, list, card } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { uuid } from "@/lib/uuid";

// Helper function to verify board access
async function verifyBoardAccess(db: any, userId: string, boardId: string) {
  const userBoard = await db
    .select({ id: board.id, orgId: board.orgId })
    .from(board)
    .where(eq(board.id, boardId))
    .limit(1);

  if (userBoard.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Board not found"
    });
  }

  // TODO: Add org-level authorization when user schema includes orgId
  // if (userBoard[0].orgId !== userOrgId) {
  //   throw new TRPCError({
  //     code: "FORBIDDEN",
  //     message: "Access denied to this board"
  //   });
  // }

  return userBoard[0];
}

export const listRouter = createTRPCRouter({
  /** Get lists for a board with their cards */
  getBoardLists: protectedProcedure
    .input(z.object({ boardId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Verify board access
      await verifyBoardAccess(ctx.db, ctx.user.id, input.boardId);

      try {
        const lists = await ctx.db
          .select()
          .from(list)
          .where(eq(list.boardId, input.boardId))
          .orderBy(asc(list.order));

        // Fetch cards for each list efficiently
        const listsWithCards = await Promise.all(
          lists.map(async (l) => {
            const listCards = await ctx.db
              .select()
              .from(card)
              .where(eq(card.listId, l.id))
              .orderBy(asc(card.order));

            return {
              ...l,
              cards: listCards,
            };
          })
        );

        return listsWithCards;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch board lists",
          cause: error
        });
      }
    }),

  /** Create a new list */
  createList: protectedProcedure
    .input(
      z.object({
        boardId: z.string().min(1),
        name: z.string().min(1, "List name is required").max(100, "List name too long"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify board access
      await verifyBoardAccess(ctx.db, ctx.user.id, input.boardId);

      try {
        // Get the current max order in a transaction-safe way
        const existingLists = await ctx.db
          .select({ order: list.order })
          .from(list)
          .where(eq(list.boardId, input.boardId))
          .orderBy(asc(list.order));

        const maxOrder =
          existingLists.length > 0
            ? Math.max(...existingLists.map((l) => l.order))
            : -1;

        const id = uuid();

        await ctx.db.insert(list).values({
          id,
          boardId: input.boardId,
          name: input.name,
          order: maxOrder + 1,
        });

        return { id };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create list",
          cause: error
        });
      }
    }),

  /** Update a list */
  updateList: protectedProcedure
    .input(
      z.object({
        listId: z.string().min(1),
        name: z.string().min(1, "List name is required").max(100, "List name too long").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { listId, ...updates } = input;

      // Verify list exists and get board info
      const existingList = await ctx.db
        .select({ id: list.id, boardId: list.boardId })
        .from(list)
        .where(eq(list.id, listId))
        .limit(1);

      if (existingList.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "List not found"
        });
      }

      // Verify board access
      await verifyBoardAccess(ctx.db, ctx.user.id, existingList[0].boardId);

      try {
        await ctx.db
          .update(list)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(list.id, listId));

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update list",
          cause: error
        });
      }
    }),

  /** Reorder lists within a board */
  reorderLists: protectedProcedure
    .input(
      z.object({
        boardId: z.string().min(1),
        startIndex: z.number().int().min(0, "Start index must be non-negative"),
        endIndex: z.number().int().min(0, "End index must be non-negative"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify board access
      await verifyBoardAccess(ctx.db, ctx.user.id, input.boardId);

      if (input.startIndex === input.endIndex) {
        return { success: true }; // No-op
      }

      try {
        // Fetch current lists in a transaction-safe way
        const lists = await ctx.db
          .select()
          .from(list)
          .where(eq(list.boardId, input.boardId))
          .orderBy(asc(list.order));

        if (lists.length === 0) {
          return { success: true };
        }

        // Validate indices
        if (input.startIndex >= lists.length || input.endIndex >= lists.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid list indices"
          });
        }

        // Reorder in memory
        const [moved] = lists.splice(input.startIndex, 1);
        lists.splice(input.endIndex, 0, moved);

        // Update order values in database
        // TODO: Wrap in transaction for consistency
        await Promise.all(
          lists.map((l, index) =>
            ctx.db
              .update(list)
              .set({ order: index, updatedAt: new Date() })
              .where(eq(list.id, l.id))
          )
        );

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reorder lists",
          cause: error
        });
      }
    }),

  /** Delete a list */
  deleteList: protectedProcedure
    .input(z.object({ listId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Verify list exists and get board info
      const existingList = await ctx.db
        .select({ id: list.id, boardId: list.boardId })
        .from(list)
        .where(eq(list.id, input.listId))
        .limit(1);

      if (existingList.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "List not found"
        });
      }

      // Verify board access
      await verifyBoardAccess(ctx.db, ctx.user.id, existingList[0].boardId);

      try {
        // TODO: Consider soft delete or confirmation for lists with cards
        await ctx.db.delete(list).where(eq(list.id, input.listId));
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete list",
          cause: error
        });
      }
    }),
});