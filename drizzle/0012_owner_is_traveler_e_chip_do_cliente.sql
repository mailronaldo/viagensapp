DROP INDEX "chips_trip_traveler_unique";--> statement-breakpoint
ALTER TABLE "chips" ALTER COLUMN "traveler_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "owner_is_traveler" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chips_trip_owner_unique" ON "chips" USING btree ("trip_id") WHERE "chips"."traveler_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chips_trip_traveler_unique" ON "chips" USING btree ("trip_id","traveler_id") WHERE "chips"."traveler_id" IS NOT NULL;