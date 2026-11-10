"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { fail, str, ISO_DATE, HH_MM } from "@/lib/form";

/**
 * Clona uma atividade (com os pontos de interesse e tips dela) para outra
 * data/horário da mesma viagem. Ingressos e passes não são clonados — são
 * sempre específicos de uma compra, não faz sentido duplicá-los.
 */
export async function cloneItemAction(tripId: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/tools/cloner?tripId=${tripId}`;

  const itemId = str(formData, "itemId");
  const targetDate = str(formData, "targetDate");
  const targetTime = str(formData, "targetTime");
  if (!itemId) fail(back, "Selecione a atividade original.");
  if (!targetDate || !ISO_DATE.test(targetDate)) fail(back, "Informe uma data válida para a cópia.");
  if (targetDate < trip.startDate || targetDate > trip.endDate) fail(back, "A data da cópia precisa estar dentro do período da viagem.");
  if (targetTime && !HH_MM.test(targetTime)) fail(back, "Horário inválido.");

  const [original] = await db
    .select()
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, tripId)))
    .limit(1);
  if (!original) fail(back, "Atividade original não encontrada.");

  const points = await db.select().from(t.itineraryItemPoints).where(eq(t.itineraryItemPoints.itemId, itemId));

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(t.itineraryItems)
      .values({
        tripId,
        cityId: original.cityId,
        date: targetDate,
        startTime: targetTime || original.startTime,
        endTime: original.endTime,
        type: original.type,
        title: original.title,
        location: original.location,
        address: original.address,
        neighborhoodId: original.neighborhoodId,
        latitude: original.latitude,
        longitude: original.longitude,
        notes: original.notes,
        costEstimate: original.costEstimate,
        ticketDocumentId: original.ticketDocumentId,
        reservationProvider: original.reservationProvider,
        reservationCode: original.reservationCode,
        reservationPrice: original.reservationPrice,
        reservationCurrency: original.reservationCurrency,
        reservationDetails: original.reservationDetails,
        reservationDocumentId: original.reservationDocumentId,
      })
      .returning({ id: t.itineraryItems.id });

    if (points.length > 0) {
      await tx.insert(t.itineraryItemPoints).values(
        points.map((p) => ({
          itemId: created.id,
          kind: p.kind,
          name: p.name,
          description: p.description,
          url: p.url,
          category: p.category,
          position: p.position,
        })),
      );
    }

    return created.id;
  });

  redirect(`/trips/${tripId}/itinerary/day/${targetDate}`);
}
