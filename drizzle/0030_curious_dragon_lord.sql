CREATE TABLE "city_neighborhoods" (
	"id" text PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "city_neighborhoods" ADD CONSTRAINT "city_neighborhoods_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "city_neighborhoods_city_idx" ON "city_neighborhoods" USING btree ("city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "city_neighborhoods_city_name_unique" ON "city_neighborhoods" USING btree ("city_id","name");