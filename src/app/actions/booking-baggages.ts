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

function parseBaggageValues(formData: FormData, back: string) {
  const bagIncluded = str(formData, "bagIncluded") === "true";
  const smallSuitcaseIncluded = str(formData, "smallSuitcaseIncluded") === "true";
  const checkedRaw = str(formData, "checkedSuitcaseCount");
  const checkedSuitcaseCount = checkedRaw ? Number(checkedRaw) : 0;
  if (!Number.isInteger(checkedSuitcaseCount) || checkedSuitcaseCount < 0 || checkedSuitcaseCount > 3) {
    fail(back, "Quantidade de mala despachada inválida.");
  }
  return { bagIncluded, smallSuitcaseIncluded, checkedSuitcaseCount };
}

export async function addBaggageAction(tripId: string, bookingId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = bookingEditPath(tripId, bookingId);

  const legId = str(formData, "legId");
  if (!legId || !(await ownLeg(tripId, bookingId, legId))) fail(back, "Trecho inválido.");

  const travelerRaw = str(formData, "travelerId");
  const travelerId = travelerRaw === "owner" ? null : travelerRaw;
  if (!(await isInTripGroup(trip, travelerId))) fail(back, "Esse viajante não está nesta viagem.");

  const v = parseBaggageValues(formData, back);

  try {
    await db.insert(t.bookingBaggages).values({ bookingLegId: legId, travelerId, ...v });
  } catch {
    fail(back, "Esse viajante já tem bagagem cadastrada neste trecho.");
  }
  redirect(back);
}

export async function updateBaggageAction(tripId: string, bookingId: string, baggageId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = bookingEditPath(tripId, bookingId);

  const [current] = await db
    .select({ id: t.bookingBaggages.id })
    .from(t.bookingBaggages)
    .innerJoin(t.bookingLegs, eq(t.bookingLegs.id, t.bookingBaggages.bookingLegId))
    .where(and(eq(t.bookingBaggages.id, baggageId), eq(t.bookingLegs.bookingId, bookingId)))
    .limit(1);
  if (!current) fail(back, "Bagagem não encontrada.");

  const v = parseBaggageValues(formData, back);
  await db.update(t.bookingBaggages).set(v).where(eq(t.bookingBaggages.id, baggageId));
  redirect(back);
}

export async function deleteBaggageAction(tripId: string, bookingId: string, baggageId: string) {
  await requireTripAccess(tripId, { write: true });
  const [current] = await db
    .select({ id: t.bookingBaggages.id })
    .from(t.bookingBaggages)
    .innerJoin(t.bookingLegs, eq(t.bookingLegs.id, t.bookingBaggages.bookingLegId))
    .where(and(eq(t.bookingBaggages.id, baggageId), eq(t.bookingLegs.bookingId, bookingId)))
    .limit(1);
  if (current) await db.delete(t.bookingBaggages).where(eq(t.bookingBaggages.id, baggageId));
  redirect(bookingEditPath(tripId, bookingId));
}
