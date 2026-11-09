"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { LOCAL_DATETIME, fail, str, toWallClock } from "@/lib/form";

function bookingEditPath(tripId: string, bookingId: string) {
  return `/trips/${tripId}/transports/${bookingId}`;
}

async function ownMultiLegBooking(tripId: string, bookingId: string) {
  const [row] = await db
    .select({ id: t.bookings.id, tripType: t.bookings.tripType })
    .from(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, tripId)))
    .limit(1);
  return row ?? null;
}

async function parseLeg(formData: FormData, tripId: string, prefix: string, back: string) {
  const at = str(formData, `${prefix}At`);
  const cityId = str(formData, `${prefix}CityId`);
  if (at && !LOCAL_DATETIME.test(at)) fail(back, "Data/hora inválida.");
  if (cityId) {
    const [city] = await db
      .select({ id: t.tripCities.cityId })
      .from(t.tripCities)
      .where(and(eq(t.tripCities.cityId, cityId), eq(t.tripCities.tripId, tripId)))
      .limit(1);
    if (!city) fail(back, "Cidade inválida.");
  }
  return { at: toWallClock(at), location: str(formData, `${prefix}Location`), cityId };
}

async function parseLegValues(formData: FormData, tripId: string, back: string) {
  const origin = await parseLeg(formData, tripId, "origin", back);
  const destination = await parseLeg(formData, tripId, "destination", back);
  if (origin.at && destination.at && destination.at < origin.at) {
    fail(back, "O destino não pode ser antes da origem.");
  }
  return {
    originAt: origin.at,
    originLocation: origin.location,
    originCityId: origin.cityId,
    destinationAt: destination.at,
    destinationLocation: destination.location,
    destinationCityId: destination.cityId,
  };
}

export async function addLegAction(tripId: string, bookingId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = bookingEditPath(tripId, bookingId);
  const booking = await ownMultiLegBooking(tripId, bookingId);
  if (!booking) redirect(`/trips/${tripId}/transports`);
  if (booking.tripType !== "MULTI_LEG") fail(back, "Esse transporte não é de múltiplos trechos.");

  const v = await parseLegValues(formData, tripId, back);
  const [{ nextOrder }] = await db
    .select({ nextOrder: sql<number>`coalesce(max(${t.bookingLegs.legOrder}), 0) + 1` })
    .from(t.bookingLegs)
    .where(eq(t.bookingLegs.bookingId, bookingId));

  await db.insert(t.bookingLegs).values({ bookingId, legOrder: nextOrder, ...v });
  redirect(back);
}

export async function updateLegAction(tripId: string, bookingId: string, legId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = bookingEditPath(tripId, bookingId);
  const booking = await ownMultiLegBooking(tripId, bookingId);
  if (!booking) redirect(`/trips/${tripId}/transports`);

  const [current] = await db
    .select({ id: t.bookingLegs.id })
    .from(t.bookingLegs)
    .where(and(eq(t.bookingLegs.id, legId), eq(t.bookingLegs.bookingId, bookingId)))
    .limit(1);
  if (!current) fail(back, "Trecho não encontrado.");

  const v = await parseLegValues(formData, tripId, back);
  await db.update(t.bookingLegs).set(v).where(eq(t.bookingLegs.id, legId));
  redirect(back);
}

export async function deleteLegAction(tripId: string, bookingId: string, legId: string) {
  await requireTripAccess(tripId, { write: true });
  await db.delete(t.bookingLegs).where(and(eq(t.bookingLegs.id, legId), eq(t.bookingLegs.bookingId, bookingId)));
  redirect(bookingEditPath(tripId, bookingId));
}
