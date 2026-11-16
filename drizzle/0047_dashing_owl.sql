CREATE TYPE "public"."store_type" AS ENUM('PHYSICAL', 'ONLINE');--> statement-breakpoint
CREATE TABLE "errand_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"errand_id" text NOT NULL,
	"document_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "store_type" DEFAULT 'PHYSICAL' NOT NULL,
	"city_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "errands" ADD COLUMN "store_id" text;--> statement-breakpoint
ALTER TABLE "errand_photos" ADD CONSTRAINT "errand_photos_errand_id_errands_id_fk" FOREIGN KEY ("errand_id") REFERENCES "public"."errands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "errand_photos" ADD CONSTRAINT "errand_photos_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "errand_photos_errand_idx" ON "errand_photos" USING btree ("errand_id");--> statement-breakpoint
CREATE INDEX "errand_photos_document_idx" ON "errand_photos" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "stores_client_idx" ON "stores" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "stores_city_idx" ON "stores" USING btree ("city_id");--> statement-breakpoint
ALTER TABLE "errands" ADD CONSTRAINT "errands_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "errands_store_idx" ON "errands" USING btree ("store_id");--> statement-breakpoint
-- Tipo de documento novo pra fotos de produto anexadas numa encomenda
-- (não é o recibo de compra, que já existe como RECEIPT).
INSERT INTO "document_types" ("id", "name") VALUES
    ('PRODUCT_PHOTO', 'Foto do produto')
ON CONFLICT ("id") DO NOTHING;