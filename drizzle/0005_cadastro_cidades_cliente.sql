CREATE TABLE "trip_cities" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"city_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "client_id" text;
--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
UPDATE "cities" SET "client_id" = "trips"."owner_id" FROM "trips" WHERE "trips"."id" = "cities"."trip_id";
--> statement-breakpoint
INSERT INTO "trip_cities" ("id", "trip_id", "city_id", "position")
SELECT gen_random_uuid()::text, "trip_id", "id", "position" FROM "cities";
--> statement-breakpoint
ALTER TABLE "cities" ALTER COLUMN "client_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "cities" DROP CONSTRAINT "cities_trip_id_trips_id_fk";
--> statement-breakpoint
DROP INDEX "cities_trip_idx";
--> statement-breakpoint
ALTER TABLE "trip_cities" ADD CONSTRAINT "trip_cities_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_cities" ADD CONSTRAINT "trip_cities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "trip_cities_unique" ON "trip_cities" USING btree ("trip_id","city_id");
--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "cities_client_idx" ON "cities" USING btree ("client_id");
--> statement-breakpoint
ALTER TABLE "cities" DROP COLUMN "trip_id";
--> statement-breakpoint
ALTER TABLE "cities" DROP COLUMN "arrival";
--> statement-breakpoint
ALTER TABLE "cities" DROP COLUMN "departure";
--> statement-breakpoint
ALTER TABLE "cities" DROP COLUMN "position";
