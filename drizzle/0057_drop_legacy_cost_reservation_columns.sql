ALTER TABLE "bookings" DROP CONSTRAINT "bookings_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "itinerary_items" DROP CONSTRAINT "itinerary_items_cost_category_expense_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "itinerary_items" DROP CONSTRAINT "itinerary_items_ticket_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "itinerary_items" DROP CONSTRAINT "itinerary_items_reservation_category_expense_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "confirmation_code";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "document_id";--> statement-breakpoint
ALTER TABLE "itinerary_items" DROP COLUMN "cost_status";--> statement-breakpoint
ALTER TABLE "itinerary_items" DROP COLUMN "cost_category";--> statement-breakpoint
ALTER TABLE "itinerary_items" DROP COLUMN "ticket_document_id";--> statement-breakpoint
ALTER TABLE "itinerary_items" DROP COLUMN "reservation_category";