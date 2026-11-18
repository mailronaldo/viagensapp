"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { fail, str } from "@/lib/form";
import { isInTripGroup } from "@/services/trip-travelers";

function bookingEditPath(tripId: string, bookingId: string) {
  return `/trips/${tripId}/transports/${bookingId}`;
}

async function ownLeg(tripId: string, bookingId: string, legId: string) {
  const [row] = await db
    .select({ id: t.bookingLegs.id })
    .from(t.bookingLegs)
    .innerJoin(t.bookings, eq(t.bookings.id, t.bookingLegs.bookingId))
    .where(and(eq(t.bookingLegs.id, legId), eq(t.bookingLegs.bookingId, bookingId), eq(t.bookings.tripId, tripId)))
    .limit(1);
  return !!row;
}

export async function addSeatAction(tripId: string, bookingId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = bookingEditPath(tripId, bookingId);

  const legId = str(formData, "legId");
  if (!legId || !(await ownLeg(tripId, bookingId, legId))) fail(back, "Trecho inválido.");

  const travelerRaw = str(formData, "travelerId");
  const travelerId = travelerRaw === "owner" ? null : travelerRaw;
  if (!(await isInTripGroup(trip, travelerId))) fail(back, "Esse viajante não está nesta viagem.");

  const seat = str(formData, "seat");
  if (!seat) fail(back, "Informe o assento.");

  try {
    await db.insert(t.bookingSeats).values({ bookingLegId: legId, travelerId, seat });
  } catch {
    fail(back, "Esse viajante já tem assento cadastrado neste trecho.");
  }
  redirect(back);
}

export async function updateSeatAction(tripId: string, bookingId: string, seatId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = bookingEditPath(tripId, bookingId);

  const [current] = await db
    .select({ id: t.bookingSeats.id })
    .from(t.bookingSeats)
    .innerJoin(t.bookingLegs, eq(t.bookingLegs.id, t.bookingSeats.bookingLegId))
    .where(and(eq(t.bookingSeats.id, seatId), eq(t.bookingLegs.bookingId, bookingId)))
    .limit(1);
  if (!current) fail(back, "Assento não encontrado.");

  const seat = str(formData, "seat");
  if (!seat) fail(back, "Informe o assento.");

  await db.update(t.bookingSeats).set({ seat }).where(eq(t.bookingSeats.id, seatId));
  redirect(back);
}

export async function deleteSeatAction(tripId: string, bookingId: string, seatId: string) {
  await requireTripAccess(tripId, { write: true });
  const [current] = await db
    .select({ id: t.bookingSeats.id })
    .from(t.bookingSeats)
    .innerJoin(t.bookingLegs, eq(t.bookingLegs.id, t.bookingSeats.bookingLegId))
    .where(and(eq(t.bookingSeats.id, seatId), eq(t.bookingLegs.bookingId, bookingId)))
    .limit(1);
  if (current) await db.delete(t.bookingSeats).where(eq(t.bookingSeats.id, seatId));
  redirect(bookingEditPath(tripId, bookingId));
}
