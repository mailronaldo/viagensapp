import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { eachDay } from "@/lib/format";

export type DaySummary = {
  date: string;
  number: number; // "Dia N"
  title: string | null;
  summary: string | null;
  cities: { id: string; name: string }[];
  activityCount: number;
};

/** Panorama da viagem: um registro por dia, com título, resumo, cidades e nº de atividades. */
export async function getItinerarySummary(trip: {
  id: string;
  startDate: string;
  endDate: string;
}): Promise<DaySummary[]> {
  const [plans, counts] = await Promise.all([
    db.select().from(t.tripDays).where(eq(t.tripDays.tripId, trip.id)),
    db
      .select({ date: t.itineraryItems.date, n: sql<number>`count(*)::int` })
      .from(t.itineraryItems)
      .where(eq(t.itineraryItems.tripId, trip.id))
      .groupBy(t.itineraryItems.date),
  ]);

  const links = plans.length
    ? await db
        .select({
          tripDayId: t.tripDayCities.tripDayId,
          id: t.cities.id,
          name: t.cities.name,
          position: t.cities.position,
        })
        .from(t.tripDayCities)
        .innerJoin(t.cities, eq(t.cities.id, t.tripDayCities.cityId))
        .where(
          inArray(
            t.tripDayCities.tripDayId,
            plans.map((p) => p.id),
          ),
        )
        .orderBy(asc(t.cities.position), asc(t.cities.name))
    : [];

  const planByDate = new Map(plans.map((p) => [p.date, p]));
  const countByDate = new Map(counts.map((c) => [c.date, c.n]));

  return eachDay(trip.startDate, trip.endDate).map((date, i) => {
    const plan = planByDate.get(date);
    return {
      date,
      number: i + 1,
      title: plan?.title ?? null,
      summary: plan?.summary ?? null,
      cities: plan
        ? links.filter((l) => l.tripDayId === plan.id).map((l) => ({ id: l.id, name: l.name }))
        : [],
      activityCount: countByDate.get(date) ?? 0,
    };
  });
}

/** Resumo de um único dia (título, descrição e ids das cidades marcadas). */
export async function getDayPlan(tripId: string, date: string) {
  const [plan] = await db
    .select()
    .from(t.tripDays)
    .where(and(eq(t.tripDays.tripId, tripId), eq(t.tripDays.date, date)))
    .limit(1);
  if (!plan) return { title: null, summary: null, cities: [] as { id: string; name: string }[] };
  const cities = await db
    .select({ id: t.cities.id, name: t.cities.name })
    .from(t.tripDayCities)
    .innerJoin(t.cities, eq(t.cities.id, t.tripDayCities.cityId))
    .where(eq(t.tripDayCities.tripDayId, plan.id))
    .orderBy(asc(t.cities.position), asc(t.cities.name));
  return { title: plan.title, summary: plan.summary, cities };
}
