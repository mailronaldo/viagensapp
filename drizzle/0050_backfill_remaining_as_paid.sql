-- Backfill extra, pedido pelo cliente depois de ver que o filtro "por
-- pagador" ficava vazio pra tudo que não tinha sido marcado "Pago" antes da
-- migração 0049: agora TODO registro antigo com valor e sem nenhum
-- pagamento lançado (não só os já "Pago") ganha 1 pagamento retroativo de
-- 100% pro dono da viagem (payer NULL, método "OUTRO"). Isso marca esses
-- registros como "Pago" automaticamente — o cliente está ciente e vai
-- corrigir manualmente os que ainda não foram pagos de verdade.
-- A condição "NOT EXISTS" garante que os já migrados em 0049 (que já têm
-- pagamento) não recebem um segundo pagamento duplicado, e o "UPDATE" em
-- cada bloco só marca "Pago" quem acabou de ganhar o pagamento NESTE
-- backfill (via CTE "inserted") — nunca sobrescreve o status de quem já
-- tinha pagamentos parciais reais lançados pela UI.

-- Despesas (Central de Custos).
WITH inserted AS (
  INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
  SELECT gen_random_uuid()::text, e."trip_id", 'EXPENSE', e."id", NULL, e."date", 'OUTRO', 'AVISTA', e."amount", e."currency", e."created_at"
  FROM "expenses" e
  WHERE NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."source_type" = 'EXPENSE' AND p."source_id" = e."id")
  RETURNING "source_id"
)
UPDATE "expenses" SET "status" = 'PAGO' WHERE "id" IN (SELECT "source_id" FROM inserted);
--> statement-breakpoint

-- Custo da atividade.
WITH inserted AS (
  INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
  SELECT gen_random_uuid()::text, i."trip_id", 'ITEM_COST', i."id", NULL, i."date", 'OUTRO', 'AVISTA', i."cost_estimate", tr."base_currency", i."created_at"
  FROM "itinerary_items" i
  JOIN "trips" tr ON tr."id" = i."trip_id"
  WHERE i."cost_estimate" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."source_type" = 'ITEM_COST' AND p."source_id" = i."id")
  RETURNING "source_id"
)
UPDATE "itinerary_items" SET "cost_status" = 'PAGO' WHERE "id" IN (SELECT "source_id" FROM inserted);
--> statement-breakpoint

-- Reserva da atividade.
WITH inserted AS (
  INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
  SELECT gen_random_uuid()::text, i."trip_id", 'ITEM_RESERVATION', i."id", NULL, i."date", 'OUTRO', 'AVISTA', i."reservation_price", COALESCE(i."reservation_currency", tr."base_currency"), i."created_at"
  FROM "itinerary_items" i
  JOIN "trips" tr ON tr."id" = i."trip_id"
  WHERE i."reservation_price" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."source_type" = 'ITEM_RESERVATION' AND p."source_id" = i."id")
  RETURNING "source_id"
)
UPDATE "itinerary_items" SET "reservation_status" = 'PAGO' WHERE "id" IN (SELECT "source_id" FROM inserted);
--> statement-breakpoint

-- Ingressos.
WITH inserted AS (
  INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
  SELECT gen_random_uuid()::text, tk."trip_id", 'ACTIVITY_TICKET', tk."id", NULL, tk."created_at"::date, 'OUTRO', 'AVISTA', tk."price", COALESCE(tk."currency", tr."base_currency"), tk."created_at"
  FROM "activity_tickets" tk
  JOIN "trips" tr ON tr."id" = tk."trip_id"
  WHERE tk."price" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."source_type" = 'ACTIVITY_TICKET' AND p."source_id" = tk."id")
  RETURNING "source_id"
)
UPDATE "activity_tickets" SET "status" = 'PAGO' WHERE "id" IN (SELECT "source_id" FROM inserted);
--> statement-breakpoint

-- Passes.
WITH inserted AS (
  INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
  SELECT gen_random_uuid()::text, p."trip_id", 'PASS', p."id", NULL, p."created_at"::date, 'OUTRO', 'AVISTA', p."price", COALESCE(p."currency", tr."base_currency"), p."created_at"
  FROM "passes" p
  JOIN "trips" tr ON tr."id" = p."trip_id"
  WHERE p."price" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "payments" pay WHERE pay."source_type" = 'PASS' AND pay."source_id" = p."id")
  RETURNING "source_id"
)
UPDATE "passes" SET "status" = 'PAGO' WHERE "id" IN (SELECT "source_id" FROM inserted);
--> statement-breakpoint

-- Vouchers de transporte.
WITH inserted AS (
  INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
  SELECT gen_random_uuid()::text, b."trip_id", 'TRANSPORT_VOUCHER', tv."id", NULL, tv."created_at"::date, 'OUTRO', 'AVISTA', tv."price", COALESCE(tv."currency", tr."base_currency"), tv."created_at"
  FROM "transport_vouchers" tv
  JOIN "bookings" b ON b."id" = tv."booking_id"
  JOIN "trips" tr ON tr."id" = b."trip_id"
  WHERE tv."price" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."source_type" = 'TRANSPORT_VOUCHER' AND p."source_id" = tv."id")
  RETURNING "source_id"
)
UPDATE "transport_vouchers" SET "status" = 'PAGO' WHERE "id" IN (SELECT "source_id" FROM inserted);
--> statement-breakpoint

-- Vouchers de hospedagem.
WITH inserted AS (
  INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
  SELECT gen_random_uuid()::text, l."trip_id", 'LODGING_VOUCHER', lv."id", NULL, lv."created_at"::date, 'OUTRO', 'AVISTA', lv."price", COALESCE(lv."currency", tr."base_currency"), lv."created_at"
  FROM "lodging_vouchers" lv
  JOIN "lodgings" l ON l."id" = lv."lodging_id"
  JOIN "trips" tr ON tr."id" = l."trip_id"
  WHERE lv."price" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."source_type" = 'LODGING_VOUCHER' AND p."source_id" = lv."id")
  RETURNING "source_id"
)
UPDATE "lodging_vouchers" SET "status" = 'PAGO' WHERE "id" IN (SELECT "source_id" FROM inserted);
--> statement-breakpoint

-- Seguro viagem.
WITH inserted AS (
  INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "payment_date", "method", "form", "amount", "currency", "created_at")
  SELECT gen_random_uuid()::text, ti."trip_id", 'TRAVEL_INSURANCE', ti."id", NULL, ti."created_at"::date, 'OUTRO', 'AVISTA', ti."price", COALESCE(ti."currency", tr."base_currency"), ti."created_at"
  FROM "travel_insurances" ti
  JOIN "trips" tr ON tr."id" = ti."trip_id"
  WHERE ti."price" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."source_type" = 'TRAVEL_INSURANCE' AND p."source_id" = ti."id")
  RETURNING "source_id"
)
UPDATE "travel_insurances" SET "status" = 'PAGO' WHERE "id" IN (SELECT "source_id" FROM inserted);
