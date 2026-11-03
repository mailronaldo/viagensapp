"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { ISO_DATE, fail, str } from "@/lib/form";

/** Salva (ou limpa) o resumo de um dia: título, descrição e cidades. */
export async function saveDayAction(tripId: string, date: string, formData: FormData) {
  const { trip } = await requireTripAccess(tripId, { write: true });
  const back = `/trips/${tripId}/itinerary/day/${date}`;

  if (!ISO_DATE.test(date) || date < trip.startDate || date > trip.endDate) {
    fail(`/trips/${tripId}/itinerary`, "Dia fora do período da viagem.");
  }
  const title = str(formData, "title");
  const summary = str(formData, "summary");
  if (title && title.length > 120) fail(back, "O título do dia pode ter até 120 caracteres.");
  if (summary && summary.length > 1000) fail(back, "A descrição do dia pode ter até 1000 caracteres.");

  const wanted = [...new Set(formData.getAll("cityIds").filter((v): v is string => typeof v === "string" && v !== ""))];
  const cityIds = wanted.length
    ? (
        await db
          .select({ id: t.cities.id })
          .from(t.cities)
          .where(and(eq(t.cities.tripId, tripId), inArray(t.cities.id, wanted)))
      ).map((c) => c.id)
    : [];
  if (cityIds.length !== wanted.length) fail(back, "Cidade inválida.");

  await db.transaction(async (tx) => {
    if (!title && !summary && cityIds.length === 0) {
      await tx
        .delete(t.tripDays)
        .where(and(eq(t.tripDays.tripId, tripId), eq(t.tripDays.date, date)));
      return;
    }
    const [day] = await tx
      .insert(t.tripDays)
      .values({ tripId, date, title, summary })
      .onConflictDoUpdate({
        target: [t.tripDays.tripId, t.tripDays.date],
        set: { title, summary },
      })
      .returning({ id: t.tripDays.id });
    await tx.delete(t.tripDayCities).where(eq(t.tripDayCities.tripDayId, day.id));
    if (cityIds.length) {
      await tx
        .insert(t.tripDayCities)
        .values(cityIds.map((cityId) => ({ tripDayId: day.id, cityId })));
    }
  });

  redirect(back);
}
