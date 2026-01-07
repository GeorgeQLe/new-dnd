CREATE TABLE "board" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text,
	"team_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card" (
	"id" text PRIMARY KEY NOT NULL,
	"list_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"due_date" timestamp,
	"progress" integer DEFAULT 0,
	"starred" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list" ADD CONSTRAINT "list_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;