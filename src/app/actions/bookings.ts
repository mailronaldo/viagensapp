"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { BOOKING_TYPE_LABEL, BOOKING_TYPE_OPTIONS, CURRENCIES } from "@/lib/labels";
import { LOCAL_DATETIME, fail, parseDecimal, str, toWallClock } from "@/lib/form";

function parseBooking(formData: FormData, back: string) {
  const type = str(formData, "type") ?? "OTHER";
  const title = str(formData, "title");
  const startAt = str(formData, "startAt");
  const endAt = str(formData, "endAt");
  const currency = str(formData, "currency");

  if (!title) fail(back, "Informe um título para o transporte.");
  if (!(BOOKING_TYPE_OPTIONS as readonly string[]).includes(type)) fail(back, "Tipo de transporte inválido.");
  if (startAt && !LOCAL_DATETIME.test(startAt)) fail(back, "Data/hora de início inválida.");
  if (endAt && !LOCAL_DATETIME.test(endAt)) fail(back, "Data/hora de término inválida.");
  if (startAt && endAt && endAt < startAt) fail(back, "O término não pode ser antes do início.");
  if (currency && !(CURRENCIES as readonly string[]).includes(currency)) {
    fail(back, "Moeda inválida.");
  }

  const priceRaw = str(formData, "totalPrice");
  const totalPrice = parseDecimal(priceRaw, { positive: true });
  if (priceRaw && totalPrice === null) fail(back, "Valor inválido.");
  if (totalPrice && !currency) fail(back, "Informe a moeda do valor.");

  return {
    type: type as keyof typeof BOOKING_TYPE_LABEL,
    title,
    provider: str(formData, "provider"),
    confirmationCode: str(formData, "confirmationCode"),
    startAt: toWallClock(startAt),
    endAt: toWallClock(endAt),
    origin: str(formData, "origin"),
    destination: str(formData, "destination"),
    address: str(formData, "address"),
    details: str(formData, "details"),
    totalPrice,
    // Sem valor, a moeda não faz sentido guardar.
    currency: totalPrice ? currency : null,
  };
}

export async function addBookingAction(tripId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/transports`;
  const v = parseBooking(formData, back);

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

  const v = parseBooking(formData, back);
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
  redirect(`/trips/${tripId}/transports`);
}

export async function deleteBookingAction(tripId: string, bookingId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, tripId)));
  redirect(`/trips/${tripId}/transports`);
}
