import "server-only";
import { asc, inArray } from "drizzle-orm";
import { db, t } from "@/db";

/** Bagagens lançadas num conjunto de trechos (1 transporte), em ordem de criação. */
export async function listBookingBaggages(legIds: string[]) {
  if (legIds.length === 0) return [];
  return db.select().from(t.bookingBaggages).where(inArray(t.bookingBaggages.bookingLegId, legIds)).orderBy(asc(t.bookingBaggages.createdAt));
}
