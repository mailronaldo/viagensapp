CREATE TYPE "public"."errand_payment_status" AS ENUM('A_PAGAR', 'PAGO');--> statement-breakpoint
CREATE TYPE "public"."errand_purchase_status" AS ENUM('AGUARDANDO_COMPRA', 'PEDIDO_APROVACAO', 'COMPRA_EFETUADA');--> statement-breakpoint
CREATE TYPE "public"."errand_value_status" AS ENUM('ESTIMADO', 'ORCAMENTO', 'REALIZADO');--> statement-breakpoint
CREATE TABLE "errands" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"traveler_id" text,
	"requester_id" text NOT NULL,
	"product" text NOT NULL,
	"price" numeric(12, 2),
	"currency" text,
	"value_status" "errand_value_status" DEFAULT 'ESTIMADO' NOT NULL,
	"payment_status" "errand_payment_status" DEFAULT 'A_PAGAR' NOT NULL,
	"purchase_status" "errand_purchase_status" DEFAULT 'AGUARDANDO_COMPRA' NOT NULL,
	"details" text,
	"receipt_document_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requesters" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "errands" ADD CONSTRAINT "errands_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "errands" ADD CONSTRAINT "errands_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "errands" ADD CONSTRAINT "errands_requester_id_requesters_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."requesters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "errands" ADD CONSTRAINT "errands_receipt_document_id_documents_id_fk" FOREIGN KEY ("receipt_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requesters" ADD CONSTRAINT "requesters_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "errands_trip_idx" ON "errands" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "errands_traveler_idx" ON "errands" USING btree ("traveler_id");--> statement-breakpoint
CREATE INDEX "errands_requester_idx" ON "errands" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "requesters_client_idx" ON "requesters" USING btree ("client_id");