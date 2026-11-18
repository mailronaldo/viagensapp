CREATE TABLE "booking_baggages" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_leg_id" text NOT NULL,
	"traveler_id" text,
	"bag_included" boolean DEFAULT false NOT NULL,
	"small_suitcase_included" boolean DEFAULT false NOT NULL,
	"checked_suitcase_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_seats" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_leg_id" text NOT NULL,
	"traveler_id" text,
	"seat" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_baggages" ADD CONSTRAINT "booking_baggages_booking_leg_id_booking_legs_id_fk" FOREIGN KEY ("booking_leg_id") REFERENCES "public"."booking_legs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_baggages" ADD CONSTRAINT "booking_baggages_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_booking_leg_id_booking_legs_id_fk" FOREIGN KEY ("booking_leg_id") REFERENCES "public"."booking_legs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_baggages_leg_traveler_unique" ON "booking_baggages" USING btree ("booking_leg_id","traveler_id") WHERE "booking_baggages"."traveler_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_baggages_leg_owner_unique" ON "booking_baggages" USING btree ("booking_leg_id") WHERE "booking_baggages"."traveler_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_seats_leg_traveler_unique" ON "booking_seats" USING btree ("booking_leg_id","traveler_id") WHERE "booking_seats"."traveler_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_seats_leg_owner_unique" ON "booking_seats" USING btree ("booking_leg_id") WHERE "booking_seats"."traveler_id" IS NULL;