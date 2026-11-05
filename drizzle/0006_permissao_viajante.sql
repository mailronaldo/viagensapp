CREATE TYPE "public"."traveler_permission" AS ENUM('READ', 'FULL');--> statement-breakpoint
ALTER TABLE "trip_travelers" ADD COLUMN "permission" "traveler_permission" DEFAULT 'READ' NOT NULL;