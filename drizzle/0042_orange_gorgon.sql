ALTER TABLE "telegram_link_tokens" ALTER COLUMN "traveler_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_links" ALTER COLUMN "traveler_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_link_tokens" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD COLUMN "client_id" text;--> statement-breakpoint
UPDATE "telegram_link_tokens" tok SET "client_id" = tr."client_id" FROM "travelers" tr WHERE tr."id" = tok."traveler_id";--> statement-breakpoint
UPDATE "telegram_links" lnk SET "client_id" = tr."client_id" FROM "travelers" tr WHERE tr."id" = lnk."traveler_id";--> statement-breakpoint
ALTER TABLE "telegram_link_tokens" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_links" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
