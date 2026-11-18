-- Copia a categoria já existente em cada origem (que continua tendo campo
-- de categoria próprio) pra todo pagamento já lançado contra ela — pra que
-- o relatório por categoria (hoje só na Central de Custos) possa cobrir
-- todos os módulos a partir de payments.category.
UPDATE "payments" p SET "category" = e."category"
FROM "expenses" e
WHERE p."source_type" = 'EXPENSE' AND p."source_id" = e."id" AND e."category" IS NOT NULL AND p."category" IS NULL;
--> statement-breakpoint

UPDATE "payments" p SET "category" = tk."category"
FROM "activity_tickets" tk
WHERE p."source_type" = 'ACTIVITY_TICKET' AND p."source_id" = tk."id" AND tk."category" IS NOT NULL AND p."category" IS NULL;
--> statement-breakpoint

UPDATE "payments" p SET "category" = ps."category"
FROM "passes" ps
WHERE p."source_type" = 'PASS' AND p."source_id" = ps."id" AND ps."category" IS NOT NULL AND p."category" IS NULL;
--> statement-breakpoint

UPDATE "payments" p SET "category" = tv."category"
FROM "transport_vouchers" tv
WHERE p."source_type" = 'TRANSPORT_VOUCHER' AND p."source_id" = tv."id" AND tv."category" IS NOT NULL AND p."category" IS NULL;
--> statement-breakpoint

UPDATE "payments" p SET "category" = lv."category"
FROM "lodging_vouchers" lv
WHERE p."source_type" = 'LODGING_VOUCHER' AND p."source_id" = lv."id" AND lv."category" IS NOT NULL AND p."category" IS NULL;
--> statement-breakpoint

UPDATE "payments" p SET "category" = ti."category"
FROM "travel_insurances" ti
WHERE p."source_type" = 'TRAVEL_INSURANCE' AND p."source_id" = ti."id" AND ti."category" IS NOT NULL AND p."category" IS NULL;
