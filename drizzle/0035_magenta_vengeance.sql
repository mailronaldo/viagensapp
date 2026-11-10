CREATE TYPE "public"."tip_cost" AS ENUM('BAIXO', 'MEDIO', 'ALTO', 'GRATIS');--> statement-breakpoint
CREATE TABLE "itinerary_item_tips" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"tip_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tips" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"city_id" text,
	"neighborhood_id" text,
	"category_id" text,
	"cost" "tip_cost",
	"url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "itinerary_item_tips" ADD CONSTRAINT "itinerary_item_tips_item_id_itinerary_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itinerary_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_item_tips" ADD CONSTRAINT "itinerary_item_tips_tip_id_tips_id_fk" FOREIGN KEY ("tip_id") REFERENCES "public"."tips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_neighborhood_id_city_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."city_neighborhoods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_category_id_tip_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tip_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "itinerary_item_tips_unique" ON "itinerary_item_tips" USING btree ("item_id","tip_id");--> statement-breakpoint
CREATE INDEX "itinerary_item_tips_item_idx" ON "itinerary_item_tips" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "tips_client_idx" ON "tips" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "tips_city_idx" ON "tips" USING btree ("city_id");