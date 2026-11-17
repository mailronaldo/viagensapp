-- Generaliza expense_payments (só despesas) pra payments (todo módulo de
-- custo da viagem), e faz backfill dos pagamentos já existentes.
-- Escrita à mão (não via drizzle-kit generate) pra preservar os dados já em
-- produção — um simples diff de schema veria isso como dropar
-- expense_payments e criar payments do zero.

-- "ALTER TYPE ... ADD VALUE" não pode ser usado na mesma transação em que o
-- valor novo é lido/gravado — e o `migrate()` do drizzle roda a pasta toda
-- numa única transação. Por isso troca de enum (cria um novo tipo já com o
-- valor "OUTRO", migra a coluna, descarta o antigo) em vez de ADD VALUE.
CREATE TYPE "payment_method_type_new" AS ENUM ('PIX', 'CREDITO', 'DEBITO', 'DINHEIRO', 'OUTRO');
--> statement-breakpoint
ALTER TABLE "expense_payments" ALTER COLUMN "method" TYPE "payment_method_type_new" USING "method"::text::"payment_method_type_new";
--> statement-breakpoint
DROP TYPE "payment_method_type";
--> statement-breakpoint
ALTER TYPE "payment_method_type_new" RENAME TO "payment_method_type";
--> statement-breakpoint

CREATE TYPE "payment_source_type" AS ENUM ('EXPENSE', 'ITEM_COST', 'ITEM_RESERVATION', 'ACTIVITY_TICKET', 'PASS', 'TRANSPORT_VOUCHER', 'LODGING_VOUCHER', 'TRAVEL_INSURANCE');
--> statement-breakpoint

-- 1. Renomeia expense_payments -> payments, generaliza as colunas.
ALTER TABLE "expense_payments" RENAME TO "payments";
--> statement-breakpoint
ALTER TABLE "payments" RENAME COLUMN "expense_id" TO "source_id";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "expense_payments_expense_id_expenses_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" RENAME CONSTRAINT "expense_payments_payer_traveler_id_travelers_id_fk" TO "payments_payer_traveler_id_travelers_id_fk";
--> statement-breakpoint
DROP INDEX "expense_payments_expense_idx";
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "source_type" "payment_source_type";
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "trip_id" text;
--> statement-breakpoint
UPDATE "payments" p SET "source_type" = 'EXPENSE', "trip_id" = (SELECT e."trip_id" FROM "expenses" e WHERE e."id" = p."source_id");
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "source_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "trip_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX "payments_source_idx" ON "payments" ("source_type", "source_id");
--> statement-breakpoint
CREATE INDEX "payments_trip_idx" ON "payments" ("trip_id");
--> statement-breakpoint

-- 2. Backfill: só pros registros já marcados "Pago" em cada módulo (mesmo
-- critério conservador do backfill da Central de Custos) — 1 pagamento de
-- 100% pro dono da viagem (payer_traveler_id NULL), meio "OUTRO" (não dá
-- pra saber o meio real).

-- Custo da atividade (itinerary_items.cost_estimate) — sem coluna de moeda
-- própria, usa a moeda base da viagem.
INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
SELECT gen_random_uuid()::text, i."trip_id", 'ITEM_COST', i."id", NULL, i."date", 'OUTRO', 'AVISTA', i."cost_estimate", tr."base_currency", i."created_at"
FROM "itinerary_items" i
JOIN "trips" tr ON tr."id" = i."trip_id"
WHERE i."cost_status" = 'PAGO' AND i."cost_estimate" IS NOT NULL;
--> statement-breakpoint

-- Reserva da atividade (itinerary_items.reservation_price).
INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
SELECT gen_random_uuid()::text, i."trip_id", 'ITEM_RESERVATION', i."id", NULL, i."date", 'OUTRO', 'AVISTA', i."reservation_price", COALESCE(i."reservation_currency", tr."base_currency"), i."created_at"
FROM "itinerary_items" i
JOIN "trips" tr ON tr."id" = i."trip_id"
WHERE i."reservation_status" = 'PAGO' AND i."reservation_price" IS NOT NULL;
--> statement-breakpoint

-- Ingressos (activity_tickets.price) — trip_id já denormalizado na própria linha.
INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
SELECT gen_random_uuid()::text, tk."trip_id", 'ACTIVITY_TICKET', tk."id", NULL, tk."created_at"::date, 'OUTRO', 'AVISTA', tk."price", COALESCE(tk."currency", tr."base_currency"), tk."created_at"
FROM "activity_tickets" tk
JOIN "trips" tr ON tr."id" = tk."trip_id"
WHERE tk."status" = 'PAGO' AND tk."price" IS NOT NULL;
--> statement-breakpoint

-- Passes (passes.price).
INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
SELECT gen_random_uuid()::text, p."trip_id", 'PASS', p."id", NULL, p."created_at"::date, 'OUTRO', 'AVISTA', p."price", COALESCE(p."currency", tr."base_currency"), p."created_at"
FROM "passes" p
JOIN "trips" tr ON tr."id" = p."trip_id"
WHERE p."status" = 'PAGO' AND p."price" IS NOT NULL;
--> statement-breakpoint

-- Vouchers de transporte (transport_vouchers.price) — trip_id via bookings.
INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
SELECT gen_random_uuid()::text, b."trip_id", 'TRANSPORT_VOUCHER', tv."id", NULL, tv."created_at"::date, 'OUTRO', 'AVISTA', tv."price", COALESCE(tv."currency", tr."base_currency"), tv."created_at"
FROM "transport_vouchers" tv
JOIN "bookings" b ON b."id" = tv."booking_id"
JOIN "trips" tr ON tr."id" = b."trip_id"
WHERE tv."status" = 'PAGO' AND tv."price" IS NOT NULL;
--> statement-breakpoint

-- Vouchers de hospedagem (lodging_vouchers.price) — trip_id via lodgings.
INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
SELECT gen_random_uuid()::text, l."trip_id", 'LODGING_VOUCHER', lv."id", NULL, lv."created_at"::date, 'OUTRO', 'AVISTA', lv."price", COALESCE(lv."currency", tr."base_currency"), lv."created_at"
FROM "lodging_vouchers" lv
JOIN "lodgings" l ON l."id" = lv."lodging_id"
JOIN "trips" tr ON tr."id" = l."trip_id"
WHERE lv."status" = 'PAGO' AND lv."price" IS NOT NULL;
--> statement-breakpoint

-- Seguro viagem (travel_insurances.price).
INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
SELECT gen_random_uuid()::text, ti."trip_id", 'TRAVEL_INSURANCE', ti."id", NULL, ti."created_at"::date, 'OUTRO', 'AVISTA', ti."price", COALESCE(ti."currency", tr."base_currency"), ti."created_at"
FROM "travel_insurances" ti
JOIN "trips" tr ON tr."id" = ti."trip_id"
WHERE ti."status" = 'PAGO' AND ti."price" IS NOT NULL;
