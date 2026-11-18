ALTER TABLE "payments" ADD COLUMN "cost_is_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cost_traveler_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cost_traveler_id_travelers_id_fk" FOREIGN KEY ("cost_traveler_id") REFERENCES "public"."travelers"("id") ON DELETE set null ON UPDATE no action;