ALTER TABLE "itinerary_item_regions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "itinerary_item_regions" CASCADE;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "neighborhood_id" text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_neighborhood_id_city_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."city_neighborhoods"("id") ON DELETE set null ON UPDATE no action;