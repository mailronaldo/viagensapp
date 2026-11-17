CREATE TYPE "public"."payment_form" AS ENUM('AVISTA', 'PARCELADO');--> statement-breakpoint
CREATE TYPE "public"."payment_method_type" AS ENUM('PIX', 'CREDITO', 'DEBITO', 'DINHEIRO');--> statement-breakpoint
CREATE TABLE "expense_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"expense_id" text NOT NULL,
	"payer_traveler_id" text,
	"payment_date" date NOT NULL,
	"method" "payment_method_type" NOT NULL,
	"form" "payment_form" DEFAULT 'AVISTA' NOT NULL,
	"installments" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_payer_traveler_id_travelers_id_fk" FOREIGN KEY ("payer_traveler_id") REFERENCES "public"."travelers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_payments_expense_idx" ON "expense_payments" USING btree ("expense_id");--> statement-breakpoint
INSERT INTO "expense_payments" ("id", "expense_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
SELECT
	gen_random_uuid()::text,
	e."id",
	(SELECT tr."id" FROM "travelers" tr WHERE tr."user_id" = e."paid_by_id" LIMIT 1),
	e."date",
	CASE
		WHEN e."payment_method" ILIKE '%pix%' THEN 'PIX'
		WHEN e."payment_method" ILIKE '%créd%' OR e."payment_method" ILIKE '%cred%' THEN 'CREDITO'
		WHEN e."payment_method" ILIKE '%déb%' OR e."payment_method" ILIKE '%deb%' THEN 'DEBITO'
		ELSE 'DINHEIRO'
	END::"public"."payment_method_type",
	'AVISTA',
	e."amount",
	e."currency",
	e."created_at"
FROM "expenses" e
WHERE e."status" = 'PAGO';--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN "payment_method";