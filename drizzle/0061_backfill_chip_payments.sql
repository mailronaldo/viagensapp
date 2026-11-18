-- Chip/eSIM nunca entrou no sistema de pagamentos (ficou de fora da
-- generalização em 0049/0050) — o custo era só um valor com status manual.
-- Mesma regra do backfill de 0050: todo chip com custo e sem nenhum
-- pagamento lançado ganha 1 pagamento retroativo de 100% pro dono da
-- viagem (payer NULL, método "OUTRO"), com "quem gerou o custo" = o próprio
-- viajante do chip (null = dono da viagem). Isso marca PAGO automaticamente
-- os que já tinham custo lançado — o cliente corrige manualmente os que
-- ainda não foram pagos de verdade.
WITH inserted AS (
  INSERT INTO "payments" ("id", "trip_id", "source_type", "source_id", "payer_traveler_id", "cost_is_group", "cost_traveler_id", "payment_date", "method", "form", "amount", "currency", "category", "created_at")
  SELECT gen_random_uuid()::text, c."trip_id", 'CHIP', c."id", NULL, false, c."traveler_id", c."created_at"::date, 'OUTRO', 'AVISTA', c."cost", COALESCE(c."currency", tr."base_currency"), c."category", c."created_at"
  FROM "chips" c
  JOIN "trips" tr ON tr."id" = c."trip_id"
  WHERE c."cost" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."source_type" = 'CHIP' AND p."source_id" = c."id")
  RETURNING "source_id"
)
UPDATE "chips" SET "status" = 'PAGO' WHERE "id" IN (SELECT "source_id" FROM inserted);
