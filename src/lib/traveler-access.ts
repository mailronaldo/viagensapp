import "server-only";
import { notFound } from "next/navigation";
import { and, eq, or } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAuth, type CurrentUser } from "./auth";
import { getTripAccessFor } from "./access";

/** Id do viajante (cadastro do cliente) ligado a este login e a esta viagem, se houver. */
export async function getTravelerIdFor(userId: string, tripId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: t.travelers.id })
    .from(t.tripTravelers)
    .innerJoin(t.travelers, eq(t.travelers.id, t.tripTravelers.travelerId))
    .where(and(eq(t.tripTravelers.tripId, tripId), eq(t.travelers.userId, userId)))
    .limit(1);
  return row?.id ?? null;
}

export type PanelAccess = {
  user: CurrentUser;
  trip: typeof t.trips.$inferSelect;
  /** "traveler": o próprio viajante (só leitura). "member": dono/equipe vendo o painel dele. */
  kind: "traveler" | "member";
  travelerId: string | null;
};

/**
 * Acesso ao painel do viajante: o viajante vinculado à viagem, ou quem é membro da viagem
 * (o dono pode abrir o painel para conferir o que o viajante enxerga). Os demais veem 404.
 */
export async function requirePanelAccess(tripId: string): Promise<PanelAccess> {
  const { user } = await requireAuth();

  if (user.role === "TRAVELER") {
    const travelerId = await getTravelerIdFor(user.id, tripId);
    if (!travelerId) notFound();
    const [trip] = await db.select().from(t.trips).where(eq(t.trips.id, tripId)).limit(1);
    if (!trip) notFound();
    return { user, trip, kind: "traveler", travelerId };
  }

  const member = await getTripAccessFor(user.id, tripId);
  if (!member) notFound();
  return { user, trip: member.trip, kind: "member", travelerId: null };
}

/**
 * O viajante pode abrir o arquivo se o documento é do grupo, é dele, ou se está anexado a
 * algo que ele já vê no painel (ingresso/reserva da atividade, transporte, hospedagem).
 * Recibos e documentos "só do dono" ficam de fora.
 */
export async function travelerCanReadDocument(
  tripId: string,
  travelerId: string,
  doc: { id: string; visibility: "OWNER" | "GROUP" | "TRAVELER"; travelerId: string | null },
): Promise<boolean> {
  if (doc.visibility === "GROUP") return true;
  if (doc.visibility === "TRAVELER" && doc.travelerId === travelerId) return true;

  const [item] = await db
    .select({ id: t.itineraryItems.id })
    .from(t.itineraryItems)
    .where(
      and(
        eq(t.itineraryItems.tripId, tripId),
        or(
          eq(t.itineraryItems.ticketDocumentId, doc.id),
          eq(t.itineraryItems.reservationDocumentId, doc.id),
        ),
      ),
    )
    .limit(1);
  if (item) return true;

  const [booking] = await db
    .select({ id: t.bookings.id })
    .from(t.bookings)
    .where(and(eq(t.bookings.tripId, tripId), eq(t.bookings.documentId, doc.id)))
    .limit(1);
  if (booking) return true;

  const [lodging] = await db
    .select({ id: t.lodgings.id })
    .from(t.lodgings)
    .where(and(eq(t.lodgings.tripId, tripId), eq(t.lodgings.documentId, doc.id)))
    .limit(1);
  return !!lodging;
}
