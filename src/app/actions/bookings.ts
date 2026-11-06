"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { CURRENCIES } from "@/lib/labels";
import { LOCAL_DATETIME, fail, parseDecimal, str, toWallClock } from "@/lib/form";

async function parseLeg(formData: FormData, tripId: string, prefix: "origin" | "destination", back: string) {
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
  return {
    at: toWallClock(at),
    location: str(formData, `${prefix}Location`),
    cityId,
  };
}

async function parseBooking(tripId: string, formData: FormData, back: string) {
  const type = str(formData, "type") ?? "OTHER";
  const title = str(formData, "title");
  const currency = str(formData, "currency");

  if (!title) fail(back, "Informe um título para o transporte.");
  const [bookingType] = await db.select({ id: t.bookingTypes.id }).from(t.bookingTypes).where(eq(t.bookingTypes.id, type)).limit(1);
  if (!bookingType) fail(back, "Tipo de transporte inválido.");
  if (currency && !(CURRENCIES as readonly string[]).includes(currency)) {
    fail(back, "Moeda inválida.");
  }

  const origin = await parseLeg(formData, tripId, "origin", back);
  const destination = await parseLeg(formData, tripId, "destination", back);
  if (origin.at && destination.at && destination.at < origin.at) {
    fail(back, "O destino não pode ser antes da origem.");
  }

  const priceRaw = str(formData, "totalPrice");
  const totalPrice = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && totalPrice === null) fail(back, "Valor inválido.");
  if (totalPrice && !currency) fail(back, "Informe a moeda do valor.");

  return {
    type,
    title,
    provider: str(formData, "provider"),
    orderNumber: str(formData, "orderNumber"),
    confirmationCode: str(formData, "confirmationCode"),
    originAt: origin.at,
    originLocation: origin.location,
    originCityId: origin.cityId,
    destinationAt: destination.at,
    destinationLocation: destination.location,
    destinationCityId: destination.cityId,
    details: str(formData, "details"),
    totalPrice,
    // Sem valor, a moeda não faz sentido guardar.
    currency: totalPrice ? currency : null,
  };
}

export async function addBookingAction(tripId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/transports`;
  const v = await parseBooking(tripId, formData, back);

  const documentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    doc: { type: "RESERVATION", title: `Reserva — ${v.title}` },
    back,
    current: null,
  });

  await db.insert(t.bookings).values({ tripId, ...v, documentId });
  redirect(back);
}

export async function updateBookingAction(tripId: string, bookingId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/transports/${bookingId}`;

  const [current] = await db
    .select()
    .from(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, tripId)))
    .limit(1);
  if (!current) redirect(`/trips/${tripId}/transports`);

  const v = await parseBooking(tripId, formData, back);
  const documentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    removeField: "removeVoucher",
    doc: { type: "RESERVATION", title: `Reserva — ${v.title}` },
    back,
    current: current.documentId,
  });

  await db
    .update(t.bookings)
    .set({ ...v, documentId })
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, tripId)));
  redirect(`${back}?saved=1`);
}

export async function deleteBookingAction(tripId: string, bookingId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, tripId)));
  redirect(`/trips/${tripId}/transports`);
}
