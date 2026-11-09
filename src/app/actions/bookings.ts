"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { LOCAL_DATETIME, fail, str, toWallClock } from "@/lib/form";

const TRIP_TYPES = new Set(["ONE_WAY", "ROUND_TRIP", "MULTI_LEG"]);

function parseTripType(formData: FormData) {
  const raw = str(formData, "tripType");
  return raw && TRIP_TYPES.has(raw) ? (raw as "ONE_WAY" | "ROUND_TRIP" | "MULTI_LEG") : "ONE_WAY";
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
  return {
    at: toWallClock(at),
    location: str(formData, `${prefix}Location`),
    cityId,
  };
}

/** Lê um trecho completo (origem + destino) do form, com o par de prefixos indicado. */
async function parseLegPair(
  formData: FormData,
  tripId: string,
  originPrefix: string,
  destinationPrefix: string,
  back: string,
) {
  const origin = await parseLeg(formData, tripId, originPrefix, back);
  const destination = await parseLeg(formData, tripId, destinationPrefix, back);
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

/**
 * Trechos do transporte, conforme o tipo de viagem: 1 (somente ida), 2 (ida e
 * volta) ou nenhum (múltiplos trechos — geridos depois pelo painel "Trechos").
 */
async function parseLegs(formData: FormData, tripId: string, tripType: string, back: string) {
  if (tripType === "MULTI_LEG") return [];
  if (tripType === "ROUND_TRIP") {
    const outbound = await parseLegPair(formData, tripId, "origin", "destination", back);
    const inbound = await parseLegPair(formData, tripId, "returnOrigin", "returnDestination", back);
    return [
      { legOrder: 1, ...outbound },
      { legOrder: 2, ...inbound },
    ];
  }
  const oneWay = await parseLegPair(formData, tripId, "origin", "destination", back);
  return [{ legOrder: 1, ...oneWay }];
}

async function parseBooking(tripId: string, formData: FormData, back: string) {
  const type = str(formData, "type") ?? "OTHER";
  const title = str(formData, "title");

  if (!title) fail(back, "Informe um título para o transporte.");
  const [bookingType] = await db.select({ id: t.bookingTypes.id }).from(t.bookingTypes).where(eq(t.bookingTypes.id, type)).limit(1);
  if (!bookingType) fail(back, "Tipo de transporte inválido.");

  return {
    type,
    title,
    provider: str(formData, "provider"),
    orderNumber: str(formData, "orderNumber"),
    confirmationCode: str(formData, "confirmationCode"),
    tripType: parseTripType(formData),
    details: str(formData, "details"),
  };
}

export async function addBookingAction(tripId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const day = str(formData, "day");
  const back = day ? `/trips/${tripId}/itinerary/day/${day}` : `/trips/${tripId}/transports`;
  const v = await parseBooking(tripId, formData, back);
  const legs = await parseLegs(formData, tripId, v.tripType, back);

  const documentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    doc: { type: "RESERVATION", title: `Reserva — ${v.title}` },
    back,
    current: null,
  });

  const [booking] = await db.insert(t.bookings).values({ tripId, ...v, documentId }).returning({ id: t.bookings.id });
  if (legs.length > 0) {
    await db.insert(t.bookingLegs).values(legs.map((leg) => ({ bookingId: booking.id, ...leg })));
  }
  // Transporte de múltiplos trechos não tem campos de origem/destino no
  // cadastro — leva direto pra edição, onde fica o painel "Trechos".
  redirect(v.tripType === "MULTI_LEG" ? `/trips/${tripId}/transports/${booking.id}` : back);
}

export async function updateBookingAction(tripId: string, bookingId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const day = str(formData, "day");
  const editUrl = `/trips/${tripId}/transports/${bookingId}`;
  const back = day ? `${editUrl}?day=${day}` : editUrl;

  const [current] = await db
    .select()
    .from(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, tripId)))
    .limit(1);
  if (!current) redirect(`/trips/${tripId}/transports`);

  const v = await parseBooking(tripId, formData, back);
  const legs = await parseLegs(formData, tripId, v.tripType, back);
  const documentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "voucher",
    removeField: "removeVoucher",
    doc: { type: "RESERVATION", title: `Reserva — ${v.title}` },
    back,
    current: current.documentId,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(t.bookings)
      .set({ ...v, documentId })
      .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, tripId)));
    // Substitui os trechos (somente ida/ida e volta) do zero — evita lidar
    // com sobra de trechos de uma troca de tipo de viagem. Múltiplos trechos
    // não mexe aqui: são geridos pelo painel "Trechos" à parte.
    if (v.tripType !== "MULTI_LEG") {
      await tx.delete(t.bookingLegs).where(eq(t.bookingLegs.bookingId, bookingId));
      if (legs.length > 0) {
        await tx.insert(t.bookingLegs).values(legs.map((leg) => ({ bookingId, ...leg })));
      }
    }
  });
  redirect(day ? `/trips/${tripId}/itinerary/day/${day}` : `${back}?saved=1`);
}

export async function deleteBookingAction(tripId: string, bookingId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, tripId)));
  redirect(`/trips/${tripId}/transports`);
}
