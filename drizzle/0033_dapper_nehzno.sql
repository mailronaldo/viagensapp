CREATE TABLE "tip_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tip_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "itinerary_item_points" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "itinerary_item_points" ADD CONSTRAINT "itinerary_item_points_category_tip_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."tip_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."tip_category";