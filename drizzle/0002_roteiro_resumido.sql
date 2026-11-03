CREATE TABLE "trip_day_cities" (
	"trip_day_id" text NOT NULL,
	"city_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_days" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"date" date NOT NULL,
	"title" text,
	"summary" text
);
--> statement-breakpoint
ALTER TABLE "trip_day_cities" ADD CONSTRAINT "trip_day_cities_trip_day_id_trip_days_id_fk" FOREIGN KEY ("trip_day_id") REFERENCES "public"."trip_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_day_cities" ADD CONSTRAINT "trip_day_cities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_day_cities_idx" ON "trip_day_cities" USING btree ("trip_day_id","city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_days_trip_date_idx" ON "trip_days" USING btree ("trip_id","date");