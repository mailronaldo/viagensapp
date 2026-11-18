-- Aditivo puro: categoria do pagamento (usada em todos os módulos) e a
-- tabela de custo avulso da atividade. "ITEM_EXPENSE" entra no enum via
-- troca de tipo (create/cast/drop/rename) em vez de ALTER TYPE ... ADD
-- VALUE, porque o migrator roda TODO o lote de migrações pendentes numa
-- única transação (ver 0049) e os backfills das próximas migrações já usam
-- esse valor — ADD VALUE não pode ser lido na mesma transação em que foi
-- adicionado.
CREATE TYPE "payment_source_type_new" AS ENUM ('EXPENSE', 'ITEM_COST', 'ITEM_RESERVATION', 'ACTIVITY_TICKET', 'PASS', 'TRANSPORT_VOUCHER', 'LODGING_VOUCHER', 'TRAVEL_INSURANCE', 'ITEM_EXPENSE');
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "source_type" TYPE "payment_source_type_new" USING "source_type"::text::"payment_source_type_new";
--> statement-breakpoint
DROP TYPE "payment_source_type";
--> statement-breakpoint
ALTER TYPE "payment_source_type_new" RENAME TO "payment_source_type";
--> statement-breakpoint

ALTER TABLE "payments" ADD COLUMN "category" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_category_expense_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."expense_categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE TABLE "item_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"trip_id" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"status" "value_status" DEFAULT 'ESTIMADO' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_expenses" ADD CONSTRAINT "item_expenses_item_id_itinerary_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itinerary_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_expenses" ADD CONSTRAINT "item_expenses_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "item_expenses_item_idx" ON "item_expenses" USING btree ("item_id");
--> statement-breakpoint
CREATE INDEX "item_expenses_trip_idx" ON "item_expenses" USING btree ("trip_id");
