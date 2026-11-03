CREATE TYPE "public"."user_role" AS ENUM('MASTER', 'CLIENT');--> statement-breakpoint
CREATE TABLE "travelers" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"document_number" text,
	"birth_date" date,
	"notes" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_travelers" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"traveler_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'CLIENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "travelers" ADD CONSTRAINT "travelers_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travelers" ADD CONSTRAINT "travelers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_travelers" ADD CONSTRAINT "trip_travelers_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_travelers" ADD CONSTRAINT "trip_travelers_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "travelers_client_idx" ON "travelers" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_travelers_unique" ON "trip_travelers" USING btree ("trip_id","traveler_id");