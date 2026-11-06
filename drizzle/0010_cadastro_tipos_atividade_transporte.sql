CREATE TABLE "activity_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activity_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "booking_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "activity_types" ("id", "name") VALUES
	('ATTRACTION', 'Atração'),
	('TOUR', 'Passeio'),
	('MEAL', 'Refeição'),
	('FREE_TIME', 'Tempo livre'),
	('OTHER', 'Outro'),
	('TRANSPORT', 'Transporte (legado)');
--> statement-breakpoint
INSERT INTO "booking_types" ("id", "name") VALUES
	('FLIGHT', 'Voo'),
	('TRANSFER', 'Transfer'),
	('TRAIN', 'Trem'),
	('CAR_RENTAL', 'Aluguel de carro'),
	('OTHER', 'Outro'),
	('HOTEL', 'Hotel (antigo)');
--> statement-breakpoint
ALTER TABLE "itinerary_items" ALTER COLUMN "type" SET DATA TYPE text USING "type"::text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ALTER COLUMN "type" SET DEFAULT 'ATTRACTION';--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "type" SET DATA TYPE text USING "type"::text;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "type" SET DEFAULT 'OTHER';--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_type_activity_types_id_fk" FOREIGN KEY ("type") REFERENCES "public"."activity_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_type_booking_types_id_fk" FOREIGN KEY ("type") REFERENCES "public"."booking_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP INDEX "bookings_trip_start_idx";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "origin_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "destination_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "origin_location" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "destination_location" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "origin_city_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "destination_city_id" text;--> statement-breakpoint
-- Preserva os dados dos campos antigos nos novos (origem/destino estruturados).
UPDATE "bookings" SET
	"origin_at" = "start_at",
	"destination_at" = "end_at",
	"origin_location" = "origin",
	"destination_location" = "destination";
--> statement-breakpoint
-- Endereço (campo único antigo) passa a viver dentro de "detalhes", já que
-- origem/destino agora têm seu próprio campo de local.
UPDATE "bookings" SET "details" = CASE
	WHEN "address" IS NOT NULL AND "address" <> '' THEN COALESCE("details" || E'\n', '') || 'Endereço: ' || "address"
	ELSE "details"
END;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_origin_city_id_cities_id_fk" FOREIGN KEY ("origin_city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_destination_city_id_cities_id_fk" FOREIGN KEY ("destination_city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "start_at";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "end_at";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "origin";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "destination";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "address";--> statement-breakpoint
CREATE INDEX "bookings_trip_start_idx" ON "bookings" USING btree ("trip_id","origin_at");--> statement-breakpoint
DROP TYPE "public"."item_type";--> statement-breakpoint
DROP TYPE "public"."booking_type";
