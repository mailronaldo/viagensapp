CREATE TYPE "public"."booking_type" AS ENUM('FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TRANSFER', 'TRAIN', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('PASSPORT', 'VISA', 'INSURANCE', 'TICKET', 'VOUCHER', 'RECEIPT', 'RESERVATION', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('FLIGHT', 'LODGING', 'FOOD', 'TRANSPORT', 'ATTRACTION', 'SHOPPING', 'INSURANCE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('ATTRACTION', 'TOUR', 'MEAL', 'TRANSPORT', 'FREE_TIME', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('OWNER', 'EDITOR', 'VIEWER');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"type" "booking_type" NOT NULL,
	"title" text NOT NULL,
	"provider" text,
	"confirmation_code" text,
	"start_at" timestamp,
	"end_at" timestamp,
	"origin" text,
	"destination" text,
	"address" text,
	"details" text,
	"total_price" numeric(12, 2),
	"currency" text,
	"document_id" text
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"arrival" date,
	"departure" date,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"type" "document_type" DEFAULT 'OTHER' NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"paid_by_id" text,
	"date" date NOT NULL,
	"category" "expense_category" DEFAULT 'OTHER' NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"exchange_rate" numeric(14, 6),
	"payment_method" text,
	"receipt_document_id" text,
	"source" text DEFAULT 'web' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_items" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"city_id" text,
	"date" date NOT NULL,
	"start_time" text,
	"end_time" text,
	"type" "item_type" DEFAULT 'ATTRACTION' NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"notes" text,
	"cost_estimate" numeric(12, 2),
	"ticket_document_id" text,
	"booking_id" text
);
--> statement-breakpoint
CREATE TABLE "trip_members" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" DEFAULT 'EDITOR' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"destination" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"base_currency" text DEFAULT 'BRL' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"whatsapp_phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_whatsapp_phone_unique" UNIQUE("whatsapp_phone")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_id_users_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_document_id_documents_id_fk" FOREIGN KEY ("receipt_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_ticket_document_id_documents_id_fk" FOREIGN KEY ("ticket_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_trip_start_idx" ON "bookings" USING btree ("trip_id","start_at");--> statement-breakpoint
CREATE INDEX "cities_trip_idx" ON "cities" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "documents_trip_type_idx" ON "documents" USING btree ("trip_id","type");--> statement-breakpoint
CREATE INDEX "expenses_trip_date_idx" ON "expenses" USING btree ("trip_id","date");--> statement-breakpoint
CREATE INDEX "items_trip_date_idx" ON "itinerary_items" USING btree ("trip_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_members_unique" ON "trip_members" USING btree ("trip_id","user_id");--> statement-breakpoint
CREATE INDEX "trip_members_user_idx" ON "trip_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trips_owner_idx" ON "trips" USING btree ("owner_id");