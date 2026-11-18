-- A categoria da reserva da atividade (reservation_category, removida em
-- 0057) passa a viver em cada pagamento (payments.category).
UPDATE "payments" p
SET "category" = i."reservation_category"
FROM "itinerary_items" i
WHERE p."source_type" = 'ITEM_RESERVATION'
  AND p."source_id" = i."id"
  AND i."reservation_category" IS NOT NULL
  AND p."category" IS NULL;
