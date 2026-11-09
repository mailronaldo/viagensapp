import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";

/** Trechos de um transporte, em ordem (1 = somente ida / ida; 2 = volta; ou N trechos). */
export async function listBookingLegs(bookingId: string) {
  return db.select().from(t.bookingLegs).where(eq(t.bookingLegs.bookingId, bookingId)).orderBy(asc(t.bookingLegs.legOrder));
}

/** Trechos de vários transportes de uma vez (listagem), agrupados por bookingId. */
export async function listLegsForBookings(bookingIds: string[]) {
  const byBooking = new Map<string, (typeof t.bookingLegs.$inferSelect)[]>();
  if (bookingIds.length === 0) return byBooking;
  const rows = await db
    .select()
    .from(t.bookingLegs)
    .where(inArray(t.bookingLegs.bookingId, bookingIds))
    .orderBy(asc(t.bookingLegs.legOrder));
  for (const leg of rows) {
    const list = byBooking.get(leg.bookingId) ?? [];
    list.push(leg);
    byBooking.set(leg.bookingId, list);
  }
  return byBooking;
}
