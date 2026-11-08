"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { attachmentFromForm } from "@/lib/attachment";
import { HH_MM, ISO_DATE, fail, parseDecimal, str } from "@/lib/form";
import { listClientCurrencyCodes } from "@/services/currencies";

async function parseItem(
  tripId: string,
  trip: { startDate: string; endDate: string; ownerId: string },
  formData: FormData,
  back: string,
) {
  const date = str(formData, "date");
  const title = str(formData, "title");
  const startTime = str(formData, "startTime");
  const endTime = str(formData, "endTime");
  const type = str(formData, "type") ?? "ATTRACTION";
  const cityId = str(formData, "cityId");

  if (!title) fail(back, "Informe o título da atividade.");
  if (!date || !ISO_DATE.test(date)) fail(back, "Data inválida.");
  if (date < trip.startDate || date > trip.endDate) {
    fail(back, "A data precisa estar dentro do período da viagem.");
  }
  if (startTime && !HH_MM.test(startTime)) fail(back, "Horário de início inválido.");
  if (endTime && !HH_MM.test(endTime)) fail(back, "Horário de término inválido.");
  if (startTime && endTime && endTime < startTime) {
    fail(back, "O término não pode ser antes do início.");
  }
  const [activityType] = await db
    .select({ id: t.activityTypes.id })
    .from(t.activityTypes)
    .where(eq(t.activityTypes.id, type))
    .limit(1);
  if (!activityType) fail(back, "Tipo inválido.");

  if (cityId) {
    const [city] = await db
      .select({ id: t.tripCities.cityId })
      .from(t.tripCities)
      .where(and(eq(t.tripCities.cityId, cityId), eq(t.tripCities.tripId, tripId)))
      .limit(1);
    if (!city) fail(back, "Cidade inválida.");
  }

  const costRaw = str(formData, "costEstimate");
  const costEstimate = parseDecimal(costRaw);
  if (costRaw && costEstimate === null) fail(back, "Valor estimado inválido.");

  const resPriceRaw = str(formData, "reservationPrice");
  const reservationPrice = parseDecimal(resPriceRaw, { positive: true });
  if (resPriceRaw && reservationPrice === null) fail(back, "Valor da reserva inválido.");
  const resCurrency = str(formData, "reservationCurrency");
  if (resCurrency) {
    const validCurrencies = await listClientCurrencyCodes(trip.ownerId);
    if (!validCurrencies.includes(resCurrency)) fail(back, "Moeda da reserva inválida.");
  }

  return {
    reservationProvider: str(formData, "reservationProvider"),
    reservationCode: str(formData, "reservationCode"),
    reservationPrice,
    // Sem valor, a moeda não é guardada.
    reservationCurrency: reservationPrice ? (resCurrency ?? "BRL") : null,
    reservationDetails: str(formData, "reservationDetails"),
    cityId,
    date,
    startTime,
    endTime,
    type,
    title,
    location: str(formData, "location"),
    address: str(formData, "address"),
    notes: str(formData, "notes"),
    costEstimate,
  };
}

export async function addItemAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  // O formulário fica na página do dia; erros voltam para ela.
  const day = str(formData, "day");
  const back =
    day && ISO_DATE.test(day) ? `/trips/${tripId}/itinerary/day/${day}` : `/trips/${tripId}/itinerary`;
  const v = await parseItem(tripId, trip, formData, back);

  const ticketDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "ticket",
    doc: { type: "TICKET", title: `Ingresso — ${v.title}` },
    back,
    current: null,
  });

  const reservationDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "reservationVoucher",
    doc: { type: "RESERVATION", title: `Reserva — ${v.title}` },
    back,
    current: null,
  });

  const [item] = await db
    .insert(t.itineraryItems)
    .values({ tripId, ...v, ticketDocumentId, reservationDocumentId })
    .returning({ id: t.itineraryItems.id });
  // Leva direto pro editar: é lá que aparecem os boxes de Ingressos, Passe, Pontos de
  // interesse, Tips e Região — todos dependem do id da atividade já existir.
  redirect(`/trips/${tripId}/itinerary/items/${item.id}?saved=activity`);
}

export async function updateItemAction(tripId: string, itemId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/itinerary/items/${itemId}`;

  const [current] = await db
    .select()
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  if (!current) redirect(`/trips/${tripId}/itinerary`);

  const v = await parseItem(tripId, trip, formData, back);
  const ticketDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "ticket",
    removeField: "removeTicket",
    doc: { type: "TICKET", title: `Ingresso — ${v.title}` },
    back,
    current: current.ticketDocumentId,
  });

  const reservationDocumentId = await attachmentFromForm({
    tripId,
    formData,
    fileField: "reservationVoucher",
    removeField: "removeReservationVoucher",
    doc: { type: "RESERVATION", title: `Reserva — ${v.title}` },
    back,
    current: current.reservationDocumentId,
  });

  await db
    .update(t.itineraryItems)
    .set({ ...v, ticketDocumentId, reservationDocumentId })
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)));

  // "Salvar alterações" e "Salvar reserva" mandam ficar na tela de edição
  // (com um aviso de qual coisa foi salva), em vez de voltar pro roteiro.
  const stay = formData.get("stayOnPage");
  if (stay === "activity" || stay === "reserva") {
    redirect(`${back}?saved=${stay}`);
  }
  redirect(`/trips/${tripId}/itinerary/day/${v.date}`);
}

export async function deleteItemAction(tripId: string, itemId: string, day: string) {
  await requireTripAccess(tripId, { write: true });
  await db
    .delete(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)));
  redirect(
    ISO_DATE.test(day) ? `/trips/${tripId}/itinerary/day/${day}` : `/trips/${tripId}/itinerary`,
  );
}

/** Remove só a reserva da atividade (a atividade fica). O voucher continua na Central de documentos. */
export async function removeReservationAction(tripId: string, itemId: string, returnTo: string) {
  await requireTripAccess(tripId, { write: true });
  const [item] = await db
    .update(t.itineraryItems)
    .set({
      reservationProvider: null,
      reservationCode: null,
      reservationPrice: null,
      reservationCurrency: null,
      reservationDetails: null,
      reservationDocumentId: null,
    })
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .returning({ date: t.itineraryItems.date });
  const day = `/trips/${tripId}/itinerary/day/${item?.date ?? ""}`;
  redirect(returnTo === "edit" ? `/trips/${tripId}/itinerary/items/${itemId}` : item ? day : `/trips/${tripId}/itinerary`);
}
