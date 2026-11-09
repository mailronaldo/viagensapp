CREATE TYPE "public"."booking_trip_type" AS ENUM('ONE_WAY', 'ROUND_TRIP', 'MULTI_LEG');--> statement-breakpoint
CREATE TABLE "booking_legs" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"leg_order" integer NOT NULL,
	"origin_at" timestamp,
	"destination_at" timestamp,
	"origin_location" text,
	"destination_location" text,
	"origin_city_id" text,
	"destination_city_id" text
);
--> statement-breakpoint
-- Preserva os transportes já cadastrados como 1 trecho (somente ida) cada.
INSERT INTO "booking_legs" ("id", "booking_id", "leg_order", "origin_at", "destination_at", "origin_location", "destination_location", "origin_city_id", "destination_city_id")
SELECT gen_random_uuid()::text, "id", 1, "origin_at", "destination_at", "origin_location", "destination_location", "origin_city_id", "destination_city_id"
FROM "bookings";
--> statement-breakpoint
DROP INDEX "bookings_trip_start_idx";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "trip_type" "booking_trip_type" DEFAULT 'ONE_WAY' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_legs" ADD CONSTRAINT "booking_legs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_legs" ADD CONSTRAINT "booking_legs_origin_city_id_cities_id_fk" FOREIGN KEY ("origin_city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_legs" ADD CONSTRAINT "booking_legs_destination_city_id_cities_id_fk" FOREIGN KEY ("destination_city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_legs_booking_idx" ON "booking_legs" USING btree ("booking_id","leg_order");--> statement-breakpoint
CREATE INDEX "booking_legs_origin_idx" ON "booking_legs" USING btree ("origin_at");--> statement-breakpoint
CREATE INDEX "booking_legs_destination_idx" ON "booking_legs" USING btree ("destination_at");--> statement-breakpoint
CREATE INDEX "bookings_trip_idx" ON "bookings" USING btree ("trip_id");