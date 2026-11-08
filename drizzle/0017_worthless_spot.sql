CREATE TABLE "currencies" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"rate_to_brl" numeric(14, 6) NOT NULL,
	"as_of_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "currencies_client_code_unique" ON "currencies" USING btree ("client_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "currency_rates_code_date_unique" ON "currency_rates" USING btree ("code","as_of_date");