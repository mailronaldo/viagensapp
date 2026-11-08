CREATE TYPE "public"."value_status" AS ENUM('ESTIMADO', 'A_PAGAR', 'PAGO');--> statement-breakpoint
ALTER TABLE "activity_tickets" ADD COLUMN "status" "value_status" DEFAULT 'ESTIMADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_tickets" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "status" "value_status" DEFAULT 'ESTIMADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "chips" ADD COLUMN "status" "value_status" DEFAULT 'ESTIMADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "chips" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "status" "value_status" DEFAULT 'ESTIMADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "cost_status" "value_status" DEFAULT 'ESTIMADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "cost_category" text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "reservation_status" "value_status" DEFAULT 'ESTIMADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "reservation_category" text;--> statement-breakpoint
ALTER TABLE "lodgings" ADD COLUMN "status" "value_status" DEFAULT 'ESTIMADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "lodgings" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "passes" ADD COLUMN "status" "value_status" DEFAULT 'ESTIMADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "passes" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "activity_tickets" ADD CONSTRAINT "activity_tickets_category_expense_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_category_expense_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chips" ADD CONSTRAINT "chips_category_expense_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_cost_category_expense_categories_id_fk" FOREIGN KEY ("cost_category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_reservation_category_expense_categories_id_fk" FOREIGN KEY ("reservation_category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_category_expense_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_category_expense_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;