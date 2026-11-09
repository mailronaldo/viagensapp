ALTER TABLE "lodgings" ADD COLUMN "pin" text;--> statement-breakpoint
ALTER TABLE "lodgings" ADD COLUMN "icon_document_id" text;--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_icon_document_id_documents_id_fk" FOREIGN KEY ("icon_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;