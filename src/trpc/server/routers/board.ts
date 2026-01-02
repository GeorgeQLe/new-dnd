import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { board } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { uuid } from "@/lib/uuid";

export const boardRouter = createTRPCRouter({
  /** Get a board */
  getBoard: protectedProcedure
    .input(z.object({ boardId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userBoard = await ctx.db
        .select()
        .from(board)
        .where(eq(board.id, input.boardId))
        .limit(1);

      if (userBoard.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Board not found"
        });
      }

      // TODO: Add org-level authorization when user schema includes orgId
      // if (userBoard[0].orgId !== ctx.user.orgId) {
      //   throw new TRPCError({
      //     code: "FORBIDDEN",
      //     message: "Access denied to this board"
      //   });
      // }

      return userBoard[0];
    }),

  /** Create a new board */
  createBoard: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Board name is required").max(100, "Board name too long"),
        orgId: z.string().min(1, "Organization ID is required"),
        projectId: z.string().optional(),
        teamId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Validate user has permission to create boards in this org
      // const userOrgs = await getUserOrganizations(ctx.user.id);
      // if (!userOrgs.includes(input.orgId)) {
      //   throw new TRPCError({
      //     code: "FORBIDDEN",
      //     message: "Cannot create board in this organization"
      //   });
      // }

      const id = uuid();

      try {
        await ctx.db.insert(board).values({
          id,
          name: input.name,
          orgId: input.orgId,
          projectId: input.projectId,
          teamId: input.teamId,
        });

        return { id };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create board",
          cause: error
        });
      }
    }),

  /** Update a board */
  updateBoard: protectedProcedure
    .input(
      z.object({
        boardId: z.string().min(1),
        name: z.string().min(1, "Board name is required").max(100, "Board name too long").optional(),
        projectId: z.string().nullable().optional(),
        teamId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { boardId, ...updates } = input;

      // Verify board exists and user has access
      const existingBoard = await ctx.db
        .select({ id: board.id, orgId: board.orgId })
        .from(board)
        .where(eq(board.id, boardId))
        .limit(1);

      if (existingBoard.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Board not found"
        });
      }

      // TODO: Add org-level authorization
      // if (existingBoard[0].orgId !== ctx.user.orgId) {
      //   throw new TRPCError({
      //     code: "FORBIDDEN",
      //     message: "Access denied to this board"
      //   });
      // }

      try {
        await ctx.db
          .update(board)
          .set(updates)
          .where(eq(board.id, boardId));

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update board",
          cause: error
        });
      }
    }),

  /** Delete a board */
  deleteBoard: protectedProcedure
    .input(z.object({ boardId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Verify board exists and user has access
      const existingBoard = await ctx.db
        .select({ id: board.id, orgId: board.orgId })
        .from(board)
        .where(eq(board.id, input.boardId))
        .limit(1);

      if (existingBoard.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Board not found"
        });
      }

      // TODO: Add org-level authorization and admin check
      // if (existingBoard[0].orgId !== ctx.user.orgId || !ctx.user.isOrgAdmin) {
      //   throw new TRPCError({
      //     code: "FORBIDDEN",
      //     message: "Access denied - admin privileges required"
      //   });
      // }

      try {
        await ctx.db.delete(board).where(eq(board.id, input.boardId));
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete board",
          cause: error
        });
      }
    }),

  /** List user's boards */
  getUserBoards: protectedProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO: Filter by user's org memberships
      // const userOrgs = await getUserOrganizations(ctx.user.id);
      // let query = ctx.db.select().from(board);

      // if (input.orgId) {
      //   if (!userOrgs.includes(input.orgId)) {
      //     throw new TRPCError({
      //       code: "FORBIDDEN",
      //       message: "Access denied to this organization"
      //     });
      //   }
      //   query = query.where(eq(board.orgId, input.orgId));
      // } else {
      //   query = query.where(inArray(board.orgId, userOrgs));
      // }

      try {
        const boards = await ctx.db
          .select()
          .from(board)
          .limit(input.limit)
          .offset(input.offset);

        return boards;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch boards",
          cause: error
        });
      }
    }),
});