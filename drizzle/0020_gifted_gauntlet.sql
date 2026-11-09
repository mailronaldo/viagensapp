CREATE TABLE "transport_vouchers" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"is_group" boolean DEFAULT false NOT NULL,
	"traveler_id" text,
	"provider" text,
	"reservation_code" text,
	"price" numeric(12, 2),
	"currency" text,
	"status" "value_status" DEFAULT 'ESTIMADO' NOT NULL,
	"category" text,
	"voucher_document_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_category_expense_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "transport_vouchers" ADD CONSTRAINT "transport_vouchers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_vouchers" ADD CONSTRAINT "transport_vouchers_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_vouchers" ADD CONSTRAINT "transport_vouchers_category_expense_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_vouchers" ADD CONSTRAINT "transport_vouchers_voucher_document_id_documents_id_fk" FOREIGN KEY ("voucher_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transport_vouchers_group_unique" ON "transport_vouchers" USING btree ("booking_id") WHERE "transport_vouchers"."is_group" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "transport_vouchers_traveler_unique" ON "transport_vouchers" USING btree ("booking_id","traveler_id") WHERE "transport_vouchers"."is_group" = false AND "transport_vouchers"."traveler_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "transport_vouchers_owner_unique" ON "transport_vouchers" USING btree ("booking_id") WHERE "transport_vouchers"."is_group" = false AND "transport_vouchers"."traveler_id" IS NULL;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "total_price";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "category";