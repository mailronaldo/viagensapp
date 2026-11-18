-- "CHIP" entra no enum via troca de tipo (create/cast/drop/rename), não
-- ALTER TYPE ... ADD VALUE: o migrator roda todo o lote de migrações
-- pendentes numa única transação (ver 0049/0051) e o backfill da próxima
-- migração já usa esse valor — ADD VALUE não pode ser lido na mesma
-- transação em que foi adicionado.
CREATE TYPE "payment_source_type_new" AS ENUM ('EXPENSE', 'ITEM_COST', 'ITEM_RESERVATION', 'ACTIVITY_TICKET', 'PASS', 'TRANSPORT_VOUCHER', 'LODGING_VOUCHER', 'TRAVEL_INSURANCE', 'ITEM_EXPENSE', 'CHIP');
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "source_type" TYPE "payment_source_type_new" USING "source_type"::text::"payment_source_type_new";
--> statement-breakpoint
DROP TYPE "payment_source_type";
--> statement-breakpoint
ALTER TYPE "payment_source_type_new" RENAME TO "payment_source_type";
