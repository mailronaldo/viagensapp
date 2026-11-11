CREATE TABLE "telegram_link_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"traveler_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_link_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"id" text PRIMARY KEY NOT NULL,
	"traveler_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"active_trip_id" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_active_trip_id_trips_id_fk" FOREIGN KEY ("active_trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_links_chat_unique" ON "telegram_links" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "telegram_links_traveler_idx" ON "telegram_links" USING btree ("traveler_id");