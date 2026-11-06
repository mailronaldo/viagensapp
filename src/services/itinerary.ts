import "server-only";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
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
  // "Atividades" do resumo conta tudo que aparece na agenda do dia: roteiro,
  // transportes que partem no dia e hospedagens com check-in/check-out no dia
  // — senão um dia só com hospedagem ou transporte aparecia "sem atividades".
  const [plans, itemCounts, bookingCounts, checkInCounts, checkOutCounts] = await Promise.all([
    db.select().from(t.tripDays).where(eq(t.tripDays.tripId, trip.id)),
    db
      .select({ date: t.itineraryItems.date, n: sql<number>`count(*)::int` })
      .from(t.itineraryItems)
      .where(eq(t.itineraryItems.tripId, trip.id))
      .groupBy(t.itineraryItems.date),
    db
      .select({ date: sql<string>`to_char(${t.bookings.originAt}, 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(t.bookings)
      .where(and(eq(t.bookings.tripId, trip.id), isNotNull(t.bookings.originAt)))
      .groupBy(sql`to_char(${t.bookings.originAt}, 'YYYY-MM-DD')`),
    db
      .select({ date: t.lodgings.checkInDate, n: sql<number>`count(*)::int` })
      .from(t.lodgings)
      .where(and(eq(t.lodgings.tripId, trip.id), isNotNull(t.lodgings.checkInDate)))
      .groupBy(t.lodgings.checkInDate),
    db
      .select({ date: t.lodgings.checkOutDate, n: sql<number>`count(*)::int` })
      .from(t.lodgings)
      .where(and(eq(t.lodgings.tripId, trip.id), isNotNull(t.lodgings.checkOutDate)))
      .groupBy(t.lodgings.checkOutDate),
  ]);
  const counts = [...itemCounts, ...bookingCounts, ...checkInCounts, ...checkOutCounts] as { date: string; n: number }[];

  const links = plans.length
    ? await db
        .select({
          tripDayId: t.tripDayCities.tripDayId,
          id: t.cities.id,
          name: t.cities.name,
        })
        .from(t.tripDayCities)
        .innerJoin(t.cities, eq(t.cities.id, t.tripDayCities.cityId))
        .innerJoin(t.tripCities, and(eq(t.tripCities.cityId, t.cities.id), eq(t.tripCities.tripId, trip.id)))
        .where(
          inArray(
            t.tripDayCities.tripDayId,
            plans.map((p) => p.id),
          ),
        )
        .orderBy(asc(t.tripCities.position), asc(t.cities.name))
    : [];

  const planByDate = new Map(plans.map((p) => [p.date, p]));
  const countByDate = new Map<string, number>();
  for (const c of counts) countByDate.set(c.date, (countByDate.get(c.date) ?? 0) + c.n);

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
    .innerJoin(t.tripCities, and(eq(t.tripCities.cityId, t.cities.id), eq(t.tripCities.tripId, tripId)))
    .where(eq(t.tripDayCities.tripDayId, plan.id))
    .orderBy(asc(t.tripCities.position), asc(t.cities.name));
  return { title: plan.title, summary: plan.summary, cities };
}
