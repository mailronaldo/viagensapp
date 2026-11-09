ALTER TABLE "lodgings" DROP CONSTRAINT "lodgings_provider_reservation_methods_id_fk";
--> statement-breakpoint
ALTER TABLE "lodgings" DROP CONSTRAINT "lodgings_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "lodging_vouchers" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "lodging_vouchers" ADD COLUMN "confirmation_code" text;--> statement-breakpoint
ALTER TABLE "lodging_vouchers" ADD COLUMN "pin" text;--> statement-breakpoint
ALTER TABLE "lodging_vouchers" ADD CONSTRAINT "lodging_vouchers_provider_reservation_methods_id_fk" FOREIGN KEY ("provider") REFERENCES "public"."reservation_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodgings" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "lodgings" DROP COLUMN "confirmation_code";--> statement-breakpoint
ALTER TABLE "lodgings" DROP COLUMN "pin";--> statement-breakpoint
ALTER TABLE "lodgings" DROP COLUMN "document_id";