CREATE TABLE "errand_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"errand_id" text NOT NULL,
	"price" numeric(12, 2),
	"currency" text,
	"value_status" "errand_value_status" DEFAULT 'ESTIMADO' NOT NULL,
	"payment_status" "errand_payment_status" DEFAULT 'A_PAGAR' NOT NULL,
	"purchase_status" "errand_purchase_status" DEFAULT 'AGUARDANDO_COMPRA' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "errand_entries" ADD CONSTRAINT "errand_entries_errand_id_errands_id_fk" FOREIGN KEY ("errand_id") REFERENCES "public"."errands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "errand_entries_errand_idx" ON "errand_entries" USING btree ("errand_id");--> statement-breakpoint
-- Preserva o valor/status de cada encomenda já cadastrada como o primeiro
-- (e até aqui único) lançamento do histórico, antes de remover essas
-- colunas de "errands".
INSERT INTO "errand_entries" ("id", "errand_id", "price", "currency", "value_status", "payment_status", "purchase_status", "created_at")
SELECT gen_random_uuid()::text, "id", "price", "currency", "value_status", "payment_status", "purchase_status", "created_at"
FROM "errands";
--> statement-breakpoint
ALTER TABLE "errands" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "errands" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "errands" DROP COLUMN "value_status";--> statement-breakpoint
ALTER TABLE "errands" DROP COLUMN "payment_status";--> statement-breakpoint
ALTER TABLE "errands" DROP COLUMN "purchase_status";