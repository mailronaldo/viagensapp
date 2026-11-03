CREATE TYPE "public"."doc_visibility" AS ENUM('OWNER', 'GROUP', 'TRAVELER');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'TRAVELER';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "visibility" "doc_visibility" DEFAULT 'OWNER' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "traveler_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE set null ON UPDATE no action;