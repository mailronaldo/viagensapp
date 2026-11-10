CREATE TABLE "tip_category_links" (
	"id" text PRIMARY KEY NOT NULL,
	"tip_id" text NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tips" DROP CONSTRAINT "tips_category_id_tip_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "tips" DROP CONSTRAINT "tips_city_id_cities_id_fk";
--> statement-breakpoint
ALTER TABLE "tips" DROP CONSTRAINT "tips_neighborhood_id_city_neighborhoods_id_fk";
--> statement-breakpoint
ALTER TABLE "tips" ALTER COLUMN "city_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tips" ALTER COLUMN "neighborhood_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tip_category_links" ADD CONSTRAINT "tip_category_links_tip_id_tips_id_fk" FOREIGN KEY ("tip_id") REFERENCES "public"."tips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_category_links" ADD CONSTRAINT "tip_category_links_category_id_tip_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tip_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tip_category_links_unique" ON "tip_category_links" USING btree ("tip_id","category_id");--> statement-breakpoint
CREATE INDEX "tip_category_links_tip_idx" ON "tip_category_links" USING btree ("tip_id");--> statement-breakpoint
CREATE INDEX "tip_category_links_category_idx" ON "tip_category_links" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_neighborhood_id_city_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."city_neighborhoods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" DROP COLUMN "category_id";