import "server-only";
import { asc, inArray } from "drizzle-orm";
import { db, t } from "@/db";

/** Assentos lançados num conjunto de trechos (1 transporte), em ordem de criação. */
export async function listBookingSeats(legIds: string[]) {
  if (legIds.length === 0) return [];
  return db.select().from(t.bookingSeats).where(inArray(t.bookingSeats.bookingLegId, legIds)).orderBy(asc(t.bookingSeats.createdAt));
}
