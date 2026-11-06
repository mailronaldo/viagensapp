import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db";

/** Ingressos já lançados numa atividade, com o nome do viajante (ou "dono da viagem"). */
export async function getActivityTickets(itemId: string, ownerName: string) {
  const rows = await db
    .select({
      ticket: t.activityTickets,
      travelerName: t.travelers.name,
    })
    .from(t.activityTickets)
    .leftJoin(t.travelers, eq(t.travelers.id, t.activityTickets.travelerId))
    .where(eq(t.activityTickets.itemId, itemId))
    .orderBy(asc(t.travelers.name));
  return rows.map((r) => ({
    ...r.ticket,
    travelerName: r.travelerName ?? `${ownerName} (dono da viagem)`,
  }));
}

/** Ingressos de um viajante (ou do dono, quando `travelerId` nulo) em toda a viagem. */
export async function listTravelerTickets(tripId: string, travelerId: string | null) {
  const rows = await db
    .select({
      ticket: t.activityTickets,
      itemTitle: t.itineraryItems.title,
      itemDate: t.itineraryItems.date,
    })
    .from(t.activityTickets)
    .innerJoin(t.itineraryItems, eq(t.itineraryItems.id, t.activityTickets.itemId))
    .where(
      and(
        eq(t.activityTickets.tripId, tripId),
        travelerId === null ? isNull(t.activityTickets.travelerId) : eq(t.activityTickets.travelerId, travelerId),
      ),
    )
    .orderBy(asc(t.itineraryItems.date));
  return rows;
}
