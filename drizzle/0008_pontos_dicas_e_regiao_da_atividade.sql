CREATE TYPE "public"."activity_point_kind" AS ENUM('POI', 'TIP');--> statement-breakpoint
CREATE TABLE "itinerary_item_points" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"kind" "activity_point_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_item_regions" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "itinerary_item_points" ADD CONSTRAINT "itinerary_item_points_item_id_itinerary_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itinerary_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_item_regions" ADD CONSTRAINT "itinerary_item_regions_item_id_itinerary_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itinerary_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "itinerary_item_points_item_idx" ON "itinerary_item_points" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "itinerary_item_regions_item_idx" ON "itinerary_item_regions" USING btree ("item_id");