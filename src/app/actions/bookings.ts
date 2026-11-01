"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { BOOKING_TYPE_LABEL, CURRENCIES } from "@/lib/labels";
import {
  LOCAL_DATETIME,
  fail,
  file,
  parseDecimal,
  str,
  toWallClock,
} from "@/lib/form";
import { addDocument } from "@/services/documents";

export async function addBookingAction(tripId: string, formData: FormData) {
  await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/bookings`;

  const type = str(formData, "type") ?? "OTHER";
  const title = str(formData, "title");
  const startAt = str(formData, "startAt");
  const endAt = str(formData, "endAt");
  const currency = str(formData, "currency");

  if (!title) fail(back, "Informe um título para a reserva.");
  if (!(type in BOOKING_TYPE_LABEL)) fail(back, "Tipo de reserva inválido.");
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

  let documentId: string | null = null;
  const voucher = file(formData, "voucher");
  if (voucher) {
    try {
      const doc = await addDocument(tripId, voucher, {
        type: "RESERVATION",
        title: `Reserva — ${title}`,
      });
      documentId = doc.id;
    } catch (e) {
      fail(back, e instanceof Error ? e.message : "Falha no upload do voucher.");
    }
  }

  await db.insert(t.bookings).values({
    tripId,
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
    currency,
    documentId,
  });

  redirect(back);
}

export async function deleteBookingAction(tripId: string, bookingId: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, tripId)));
  redirect(`/trips/${tripId}/bookings`);
}
