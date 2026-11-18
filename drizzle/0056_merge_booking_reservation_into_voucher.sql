-- Mescla a reserva do transporte (confirmation_code/document_id do booking,
-- removidos em 0057) no voucher de transporte — reserva e voucher eram dois
-- conceitos duplicados, agora só existe um "Voucher/Reserva".

-- 1) Booking já tem voucher de grupo: preserva o que já está no voucher
--    (COALESCE), só completa o que estiver vazio.
UPDATE "transport_vouchers" tv
SET "reservation_code" = COALESCE(tv."reservation_code", b."confirmation_code"),
    "voucher_document_id" = COALESCE(tv."voucher_document_id", b."document_id")
FROM "bookings" b
WHERE tv."booking_id" = b."id"
  AND tv."is_group" = true
  AND (b."confirmation_code" IS NOT NULL OR b."document_id" IS NOT NULL);
--> statement-breakpoint

-- 2) Booking sem voucher de grupo: cria um novo com os dados da reserva antiga.
INSERT INTO "transport_vouchers" ("id", "booking_id", "is_group", "traveler_id", "reservation_code", "voucher_document_id", "status", "created_at")
SELECT gen_random_uuid()::text, b."id", true, NULL, b."confirmation_code", b."document_id", 'ESTIMADO', now()
FROM "bookings" b
WHERE (b."confirmation_code" IS NOT NULL OR b."document_id" IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM "transport_vouchers" tv WHERE tv."booking_id" = b."id" AND tv."is_group" = true);
