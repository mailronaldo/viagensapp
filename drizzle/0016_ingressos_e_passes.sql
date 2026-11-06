CREATE TABLE "activity_pass_usages" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"pass_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"trip_id" text NOT NULL,
	"traveler_id" text,
	"provider" text,
	"ticket_number" text,
	"price" numeric(12, 2),
	"currency" text,
	"voucher_document_id" text,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passes" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"traveler_id" text,
	"name" text NOT NULL,
	"provider" text,
	"validity_days" integer,
	"max_uses" integer,
	"price" numeric(12, 2),
	"currency" text,
	"pass_number" text,
	"first_used_at" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_pass_usages" ADD CONSTRAINT "activity_pass_usages_item_id_itinerary_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itinerary_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_pass_usages" ADD CONSTRAINT "activity_pass_usages_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_tickets" ADD CONSTRAINT "activity_tickets_item_id_itinerary_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itinerary_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_tickets" ADD CONSTRAINT "activity_tickets_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_tickets" ADD CONSTRAINT "activity_tickets_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_tickets" ADD CONSTRAINT "activity_tickets_voucher_document_id_documents_id_fk" FOREIGN KEY ("voucher_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_pass_usages_unique" ON "activity_pass_usages" USING btree ("item_id","pass_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_tickets_item_traveler_unique" ON "activity_tickets" USING btree ("item_id","traveler_id") WHERE "activity_tickets"."traveler_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_tickets_item_owner_unique" ON "activity_tickets" USING btree ("item_id") WHERE "activity_tickets"."traveler_id" IS NULL;--> statement-breakpoint
CREATE INDEX "activity_tickets_trip_traveler_idx" ON "activity_tickets" USING btree ("trip_id","traveler_id");--> statement-breakpoint
CREATE INDEX "passes_trip_traveler_idx" ON "passes" USING btree ("trip_id","traveler_id");