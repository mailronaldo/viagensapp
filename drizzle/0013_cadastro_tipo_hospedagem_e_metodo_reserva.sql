CREATE TABLE "lodging_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lodging_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "reservation_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_methods_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "lodging_types" ("id", "name") VALUES
	('HOTEL', 'Hotel'),
	('RENTAL', 'Aluguel / Airbnb'),
	('HOSTEL', 'Hostel / pousada'),
	('RESORT', 'Resort'),
	('OTHER', 'Outro');
--> statement-breakpoint
INSERT INTO "reservation_methods" ("id", "name") VALUES
	('BOOKING', 'Booking.com'),
	('AIRBNB', 'Airbnb'),
	('DIRECT', 'Direto com o hotel/anfitrião'),
	('AGENCY', 'Agência de viagens'),
	('OTHER', 'Outro');
--> statement-breakpoint
-- Preserva métodos de reserva já digitados como texto livre: cria um cadastro
-- novo para cada valor distinto que ainda não bate com nenhum já semeado.
INSERT INTO "reservation_methods" ("id", "name")
SELECT gen_random_uuid()::text, distinct_provider.provider
FROM (
	SELECT DISTINCT trim("provider") AS provider FROM "lodgings" WHERE "provider" IS NOT NULL AND trim("provider") <> ''
) distinct_provider
WHERE NOT EXISTS (
	SELECT 1 FROM "reservation_methods" rm WHERE lower(rm.name) = lower(distinct_provider.provider)
);
--> statement-breakpoint
ALTER TABLE "lodgings" ALTER COLUMN "type" SET DATA TYPE text USING "type"::text;--> statement-breakpoint
ALTER TABLE "lodgings" ALTER COLUMN "type" SET DEFAULT 'HOTEL';--> statement-breakpoint
UPDATE "lodgings" l
SET "provider" = rm.id
FROM "reservation_methods" rm
WHERE l."provider" IS NOT NULL AND lower(trim(l."provider")) = lower(rm.name);
--> statement-breakpoint
UPDATE "lodgings" SET "provider" = NULL WHERE "provider" IS NOT NULL AND "provider" NOT IN (SELECT id FROM "reservation_methods");
--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_type_lodging_types_id_fk" FOREIGN KEY ("type") REFERENCES "public"."lodging_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodgings" ADD CONSTRAINT "lodgings_provider_reservation_methods_id_fk" FOREIGN KEY ("provider") REFERENCES "public"."reservation_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."lodging_type";
