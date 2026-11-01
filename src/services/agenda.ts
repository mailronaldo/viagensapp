import "server-only";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { todayIn } from "@/lib/format";

/**
 * Camada de serviços: funções puras de negócio, sem Next.js/HTTP.
 * Tanto as telas web quanto o futuro webhook do WhatsApp chamam estas
 * mesmas funções (a autorização — usuário é membro da viagem — é feita
 * antes, em lib/access.ts).
 */

export type AgendaEntry = {
  id: string;
  kind: "item" | "booking";
  time: string | null; // "HH:MM"
  title: string;
  type: string;
  location: string | null;
  address: string | null;
  notes: string | null;
  cityName: string | null;
  hasTicket: boolean;
  ticketDocumentId: string | null;
};

export type Agenda = {
  date: string;
  entries: AgendaEntry[];
};

export async function getAgenda(
  trip: { id: string; timezone: string },
  date?: string,
): Promise<Agenda> {
  const day = date ?? todayIn(trip.timezone);

  const items = await db
    .select({
      id: t.itineraryItems.id,
      startTime: t.itineraryItems.startTime,
      title: t.itineraryItems.title,
      type: t.itineraryItems.type,
      location: t.itineraryItems.location,
      address: t.itineraryItems.address,
      notes: t.itineraryItems.notes,
      cityName: t.cities.name,
      ticketDocumentId: t.itineraryItems.ticketDocumentId,
    })
    .from(t.itineraryItems)
    .leftJoin(t.cities, eq(t.cities.id, t.itineraryItems.cityId))
    .where(and(eq(t.itineraryItems.tripId, trip.id), eq(t.itineraryItems.date, day)))
    .orderBy(
      sql`${t.itineraryItems.startTime} asc nulls last`,
      asc(t.itineraryItems.title),
    );

  // Reservas que começam nesse dia (voos, check-in de hotel, transfers...)
  const dayStart = `${day} 00:00:00`;
  const dayEnd = `${day} 23:59:59`;
  const bookings = await db
    .select()
    .from(t.bookings)
    .where(
      and(
        eq(t.bookings.tripId, trip.id),
        gte(t.bookings.startAt, dayStart),
        lte(t.bookings.startAt, dayEnd),
      ),
    );

  const entries: AgendaEntry[] = [
    ...items.map((i) => ({
      id: i.id,
      kind: "item" as const,
      time: i.startTime,
      title: i.title,
      type: i.type,
      location: i.location,
      address: i.address,
      notes: i.notes,
      cityName: i.cityName,
      hasTicket: !!i.ticketDocumentId,
      ticketDocumentId: i.ticketDocumentId,
    })),
    ...bookings.map((b) => ({
      id: b.id,
      kind: "booking" as const,
      time: b.startAt ? b.startAt.slice(11, 16) : null,
      title: b.title,
      type: b.type,
      location: b.origin && b.destination ? `${b.origin} → ${b.destination}` : b.address,
      address: b.address,
      notes: b.confirmationCode ? `Código: ${b.confirmationCode}` : b.details,
      cityName: null,
      hasTicket: !!b.documentId,
      ticketDocumentId: b.documentId,
    })),
  ];

  entries.sort((a, b) => {
    if (a.time === b.time) return 0;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return a.time.localeCompare(b.time);
  });

  return { date: day, entries };
}
