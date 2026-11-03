CREATE TYPE "public"."lodging_type" AS ENUM('HOTEL', 'RENTAL', 'HOSTEL', 'RESORT', 'OTHER');--> statement-breakpoint
CREATE TABLE "lodgings" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"city_id" text,
	"type" "lodging_type" DEFAULT 'HOTEL' NOT NULL,
	"name" text NOT NULL,
	"provider" text,
	"address" text,
	"check_in_date" date,
	"check_in_time" text,
	"check_out_date" date,
	"check_out_time" text,
	"confirmation_code" text,
	"total_price" numeric(12, 2),
	"currency" text,
	"notes" text,
	"document_id" text
);
--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "reservation_provider" text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "reservation_code" text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "reservation_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "reservation_currency" text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "reservation_details" text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "reservation_document_id" text;--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lodgings_trip_checkin_idx" ON "lodgings" USING btree ("trip_id","check_in_date");--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_reservation_document_id_documents_id_fk" FOREIGN KEY ("reservation_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Dados: reservas do tipo Hotel passam para Hospedagens (mesmo id) e saem de Transportes.
INSERT INTO "lodgings" ("id","trip_id","type","name","provider","address","check_in_date","check_in_time","check_out_date","check_out_time","confirmation_code","total_price","currency","notes","document_id")
SELECT "id","trip_id",'HOTEL',"title","provider","address",
  "start_at"::date, to_char("start_at",'HH24:MI'), "end_at"::date, to_char("end_at",'HH24:MI'),
  "confirmation_code","total_price","currency","details","document_id"
FROM "bookings" WHERE "type"='HOTEL';--> statement-breakpoint
DELETE FROM "bookings" WHERE "type"='HOTEL';
