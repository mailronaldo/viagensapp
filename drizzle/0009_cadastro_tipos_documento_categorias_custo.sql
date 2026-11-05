CREATE TABLE "document_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "document_types" ("id", "name") VALUES
	('PASSPORT', 'Passaporte'),
	('VISA', 'Visto'),
	('INSURANCE', 'Seguro viagem'),
	('TICKET', 'Ingresso'),
	('VOUCHER', 'Voucher'),
	('RECEIPT', 'Nota / recibo'),
	('RESERVATION', 'Reserva'),
	('OTHER', 'Outro');
--> statement-breakpoint
INSERT INTO "expense_categories" ("id", "name") VALUES
	('FLIGHT', 'Passagens'),
	('LODGING', 'Hospedagem'),
	('FOOD', 'Alimentação'),
	('TRANSPORT', 'Transporte'),
	('ATTRACTION', 'Passeios e ingressos'),
	('SHOPPING', 'Compras'),
	('INSURANCE', 'Seguro'),
	('OTHER', 'Outros');
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "type" SET DATA TYPE text USING "type"::text;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "type" SET DEFAULT 'OTHER';--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "category" SET DATA TYPE text USING "category"::text;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "category" SET DEFAULT 'OTHER';--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_type_document_types_id_fk" FOREIGN KEY ("type") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_expense_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."document_type";--> statement-breakpoint
DROP TYPE "public"."expense_category";
