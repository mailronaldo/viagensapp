CREATE TABLE "travel_insurances" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"traveler_id" text,
	"provider" text,
	"policy_number" text,
	"coverage_amount" numeric(12, 2),
	"coverage_currency" text,
	"start_date" date,
	"end_date" date,
	"price" numeric(12, 2),
	"currency" text,
	"status" "value_status" DEFAULT 'ESTIMADO' NOT NULL,
	"category" text,
	"policy_document_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "travel_insurances" ADD CONSTRAINT "travel_insurances_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_insurances" ADD CONSTRAINT "travel_insurances_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_insurances" ADD CONSTRAINT "travel_insurances_category_expense_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_insurances" ADD CONSTRAINT "travel_insurances_policy_document_id_documents_id_fk" FOREIGN KEY ("policy_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "travel_insurances_trip_traveler_unique" ON "travel_insurances" USING btree ("trip_id","traveler_id") WHERE "travel_insurances"."traveler_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "travel_insurances_trip_owner_unique" ON "travel_insurances" USING btree ("trip_id") WHERE "travel_insurances"."traveler_id" IS NULL;