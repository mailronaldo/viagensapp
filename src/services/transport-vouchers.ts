import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";

/** Vouchers de um transporte, com o nome do viajante (ou "grupo" / dono). */
export async function listBookingVouchers(bookingId: string, ownerName: string) {
  const rows = await db
    .select({ voucher: t.transportVouchers, travelerName: t.travelers.name })
    .from(t.transportVouchers)
    .leftJoin(t.travelers, eq(t.travelers.id, t.transportVouchers.travelerId))
    .where(eq(t.transportVouchers.bookingId, bookingId))
    .orderBy(asc(t.transportVouchers.createdAt));
  return rows.map((r) => ({
    ...r.voucher,
    scopeLabel: r.voucher.isGroup ? "Grupo" : r.travelerName ?? `${ownerName} (dono da viagem)`,
  }));
}

/** Vouchers de vários transportes de uma vez (listagem), já com o nome do viajante. */
export async function listVouchersForBookings(bookingIds: string[], ownerName: string) {
  if (bookingIds.length === 0) return new Map<string, Awaited<ReturnType<typeof listBookingVouchers>>>();
  const rows = await db
    .select({ voucher: t.transportVouchers, travelerName: t.travelers.name })
    .from(t.transportVouchers)
    .leftJoin(t.travelers, eq(t.travelers.id, t.transportVouchers.travelerId))
    .where(inArray(t.transportVouchers.bookingId, bookingIds))
    .orderBy(asc(t.transportVouchers.createdAt));
  const byBooking = new Map<string, { scopeLabel: string; price: string | null; currency: string | null; status: string }[]>();
  for (const r of rows) {
    const list = byBooking.get(r.voucher.bookingId) ?? [];
    list.push({
      scopeLabel: r.voucher.isGroup ? "Grupo" : r.travelerName ?? `${ownerName} (dono da viagem)`,
      price: r.voucher.price,
      currency: r.voucher.currency,
      status: r.voucher.status,
    });
    byBooking.set(r.voucher.bookingId, list);
  }
  return byBooking;
}
