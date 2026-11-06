CREATE TYPE "public"."chip_type" AS ENUM('CHIP', 'ESIM');--> statement-breakpoint
CREATE TABLE "chips" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"traveler_id" text NOT NULL,
	"provider" text,
	"order_number" text,
	"plan" text,
	"cost" numeric(12, 2),
	"currency" text,
	"receipt_document_id" text,
	"start_date" date,
	"end_date" date,
	"type" "chip_type" DEFAULT 'CHIP' NOT NULL,
	"eid" text,
	"imei2" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chips" ADD CONSTRAINT "chips_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chips" ADD CONSTRAINT "chips_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chips" ADD CONSTRAINT "chips_receipt_document_id_documents_id_fk" FOREIGN KEY ("receipt_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chips_trip_traveler_unique" ON "chips" USING btree ("trip_id","traveler_id");