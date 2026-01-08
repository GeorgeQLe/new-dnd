import { createTRPCRouter } from "../init";
import { boardRouter } from "./board";
import { listRouter } from "./list";
import { cardRouter } from "./card";

export const appRouter = createTRPCRouter({
  board: boardRouter,
  list: listRouter,
  card: cardRouter,
});

export type AppRouter = typeof appRouter;