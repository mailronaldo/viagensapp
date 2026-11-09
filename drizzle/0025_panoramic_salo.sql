ALTER TABLE "bookings" DROP CONSTRAINT "bookings_origin_city_id_cities_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_destination_city_id_cities_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "origin_at";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "destination_at";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "origin_location";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "destination_location";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "origin_city_id";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "destination_city_id";