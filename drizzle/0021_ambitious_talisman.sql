CREATE TABLE "lodging_type_subcategories" (
	"id" text PRIMARY KEY NOT NULL,
	"lodging_type_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lodging_voucher_travelers" (
	"voucher_id" text NOT NULL,
	"traveler_id" text
);
--> statement-breakpoint
CREATE TABLE "lodging_vouchers" (
	"id" text PRIMARY KEY NOT NULL,
	"lodging_id" text NOT NULL,
	"name" text NOT NULL,
	"subcategory_id" text,
	"is_group" boolean DEFAULT false NOT NULL,
	"price" numeric(12, 2),
	"currency" text,
	"status" "value_status" DEFAULT 'ESTIMADO' NOT NULL,
	"category" text,
	"voucher_document_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lodgings" DROP CONSTRAINT "lodgings_category_expense_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "lodging_type_subcategories" ADD CONSTRAINT "lodging_type_subcategories_lodging_type_id_lodging_types_id_fk" FOREIGN KEY ("lodging_type_id") REFERENCES "public"."lodging_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodging_voucher_travelers" ADD CONSTRAINT "lodging_voucher_travelers_voucher_id_lodging_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."lodging_vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodging_voucher_travelers" ADD CONSTRAINT "lodging_voucher_travelers_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodging_vouchers" ADD CONSTRAINT "lodging_vouchers_lodging_id_lodgings_id_fk" FOREIGN KEY ("lodging_id") REFERENCES "public"."lodgings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodging_vouchers" ADD CONSTRAINT "lodging_vouchers_subcategory_id_lodging_type_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."lodging_type_subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodging_vouchers" ADD CONSTRAINT "lodging_vouchers_category_expense_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodging_vouchers" ADD CONSTRAINT "lodging_vouchers_voucher_document_id_documents_id_fk" FOREIGN KEY ("voucher_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lodging_type_subcategories_type_name_unique" ON "lodging_type_subcategories" USING btree ("lodging_type_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "lodging_voucher_travelers_traveler_unique" ON "lodging_voucher_travelers" USING btree ("voucher_id","traveler_id") WHERE "lodging_voucher_travelers"."traveler_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lodging_voucher_travelers_owner_unique" ON "lodging_voucher_travelers" USING btree ("voucher_id") WHERE "lodging_voucher_travelers"."traveler_id" IS NULL;--> statement-breakpoint
ALTER TABLE "lodgings" DROP COLUMN "total_price";--> statement-breakpoint
ALTER TABLE "lodgings" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "lodgings" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "lodgings" DROP COLUMN "category";