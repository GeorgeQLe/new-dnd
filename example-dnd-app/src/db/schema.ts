import { boolean, integer, pgTable, timestamp, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(()=> user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

// ============================================================
// Kanban Schema
// ============================================================

export const board = pgTable("board", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  orgId: text("org_id").notNull(),
  projectId: text("project_id"),
  teamId: text("team_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const boardRelations = relations(board, ({ many }) => ({
  lists: many(list),
}));

export const list = pgTable("list", {
  id: text("id").primaryKey(),
  boardId: text("board_id").notNull().references(() => board.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const listRelations = relations(list, ({ one, many }) => ({
  board: one(board, {
    fields: [list.boardId],
    references: [board.id],
  }),
  cards: many(card),
}));

export const card = pgTable("card", {
  id: text("id").primaryKey(),
  listId: text("list_id").notNull().references(() => list.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  dueDate: timestamp("due_date"),
  progress: integer("progress").default(0),
  starred: boolean("starred").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cardRelations = relations(card, ({ one }) => ({
  list: one(list, {
    fields: [card.listId],
    references: [list.id],
  }),
}));

// ============================================================
// Type Exports
// ============================================================
export type Board = typeof board.$inferSelect;
export type NewBoard = typeof board.$inferInsert;
export type List = typeof list.$inferSelect;
export type NewList = typeof list.$inferInsert;
export type Card = typeof card.$inferSelect;
export type NewCard = typeof card.$inferInsert;

export type ListWithCards = List & { cards: Card[] };
export type BoardWithLists = Board & { lists: ListWithCards[] };