-- Migra pagamentos já lançados contra o antigo custo estimado da atividade
-- (ITEM_COST) pra um lançamento de custo avulso (ITEM_EXPENSE) — sem isso,
-- esses pagamentos ficariam órfãos quando cost_status/cost_category forem
-- derrubados (0057). Atividades com só um cost_estimate informativo, nunca
-- pago, não ganham lançamento nenhum — o campo continua na atividade.
WITH distinct_items AS (
  SELECT DISTINCT p."source_id" AS item_id
  FROM "payments" p
  WHERE p."source_type" = 'ITEM_COST'
),
inserted AS (
  INSERT INTO "item_expenses" ("id", "item_id", "trip_id", "description", "amount", "currency", "status", "created_at")
  SELECT
    gen_random_uuid()::text,
    i."id",
    i."trip_id",
    'Custo (migrado)',
    COALESCE(i."cost_estimate", (SELECT COALESCE(SUM(p2."amount"), 0) FROM "payments" p2 WHERE p2."source_type" = 'ITEM_COST' AND p2."source_id" = i."id")),
    tr."base_currency",
    i."cost_status",
    i."created_at"
  FROM distinct_items di
  JOIN "itinerary_items" i ON i."id" = di.item_id
  JOIN "trips" tr ON tr."id" = i."trip_id"
  RETURNING "id" AS new_id, "item_id" AS old_item_id
)
UPDATE "payments" p
SET "source_type" = 'ITEM_EXPENSE', "source_id" = ins.new_id
FROM inserted ins
WHERE p."source_type" = 'ITEM_COST' AND p."source_id" = ins.old_item_id;
