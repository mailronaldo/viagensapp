import "server-only";
import { and, asc, eq, gte, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, t } from "@/db";
import { todayIn } from "@/lib/format";

const originCity = alias(t.cities, "origin_city");
const destinationCity = alias(t.cities, "destination_city");

/**
 * Camada de serviços: funções puras de negócio, sem Next.js/HTTP.
 * Tanto as telas web quanto o futuro webhook do WhatsApp chamam estas
 * mesmas funções (a autorização — usuário é membro da viagem — é feita
 * antes, em lib/access.ts).
 */

export type AgendaEntry = {
  id: string;
  kind: "item" | "booking" | "lodging";
  time: string | null; // "HH:MM"
  title: string;
  type: string;
  location: string | null;
  address: string | null;
  notes: string | null;
  cityName: string | null;
  hasTicket: boolean;
  ticketDocumentId: string | null;
  /** Só para atividades: dados da reserva (null = sem reserva). */
  reservation: {
    provider: string | null;
    code: string | null;
    price: string | null;
    currency: string | null;
    documentId: string | null;
  } | null;
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
      reservationProvider: t.itineraryItems.reservationProvider,
      reservationCode: t.itineraryItems.reservationCode,
      reservationPrice: t.itineraryItems.reservationPrice,
      reservationCurrency: t.itineraryItems.reservationCurrency,
      reservationDetails: t.itineraryItems.reservationDetails,
      reservationDocumentId: t.itineraryItems.reservationDocumentId,
    })
    .from(t.itineraryItems)
    .leftJoin(t.cities, eq(t.cities.id, t.itineraryItems.cityId))
    .where(and(eq(t.itineraryItems.tripId, trip.id), eq(t.itineraryItems.date, day)))
    .orderBy(
      sql`${t.itineraryItems.startTime} asc nulls last`,
      asc(t.itineraryItems.title),
    );

  // Transportes que começam nesse dia (voos, transfers, trens...)
  const dayStart = `${day} 00:00:00`;
  const dayEnd = `${day} 23:59:59`;
  const bookings = await db
    .select({
      booking: t.bookings,
      originCityName: originCity.name,
      destinationCityName: destinationCity.name,
    })
    .from(t.bookings)
    .leftJoin(originCity, eq(originCity.id, t.bookings.originCityId))
    .leftJoin(destinationCity, eq(destinationCity.id, t.bookings.destinationCityId))
    .where(
      and(
        eq(t.bookings.tripId, trip.id),
        gte(t.bookings.originAt, dayStart),
        lte(t.bookings.originAt, dayEnd),
      ),
    );

  // Transporte que chega num dia diferente de quando partiu (ex.: voo noturno):
  // também entra na agenda do dia da chegada, como "Chegada: …".
  const arrivalRows = await db
    .select({
      booking: t.bookings,
      originCityName: originCity.name,
      destinationCityName: destinationCity.name,
    })
    .from(t.bookings)
    .leftJoin(originCity, eq(originCity.id, t.bookings.originCityId))
    .leftJoin(destinationCity, eq(destinationCity.id, t.bookings.destinationCityId))
    .where(
      and(
        eq(t.bookings.tripId, trip.id),
        gte(t.bookings.destinationAt, dayStart),
        lte(t.bookings.destinationAt, dayEnd),
      ),
    );
  const arrivals = arrivalRows.filter(
    ({ booking: b }) => !b.originAt || b.originAt.slice(0, 10) !== b.destinationAt!.slice(0, 10),
  );

  // Hospedagens: check-in e check-out caem no dia como entradas da agenda.
  const lodgingRows = await db
    .select()
    .from(t.lodgings)
    .where(
      and(
        eq(t.lodgings.tripId, trip.id),
        or(eq(t.lodgings.checkInDate, day), eq(t.lodgings.checkOutDate, day)),
      ),
    );
  const lodgingEntries: AgendaEntry[] = lodgingRows.flatMap((l) => {
    const base = {
      id: l.id,
      kind: "lodging" as const,
      type: l.type,
      location: null,
      address: l.address,
      notes: l.confirmationCode ? `Código: ${l.confirmationCode}` : null,
      cityName: null,
      hasTicket: !!l.documentId,
      ticketDocumentId: l.documentId,
      reservation: null,
    };
    const out: AgendaEntry[] = [];
    if (l.checkOutDate === day) {
      out.push({ ...base, time: l.checkOutTime, title: `Check-out: ${l.name}` });
    }
    if (l.checkInDate === day) {
      out.push({ ...base, time: l.checkInTime, title: `Check-in: ${l.name}` });
    }
    return out;
  });

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
      reservation:
        i.reservationProvider ||
        i.reservationCode ||
        i.reservationPrice ||
        i.reservationDetails ||
        i.reservationDocumentId
          ? {
              provider: i.reservationProvider,
              code: i.reservationCode,
              price: i.reservationPrice,
              currency: i.reservationCurrency,
              documentId: i.reservationDocumentId,
            }
          : null,
    })),
    ...bookings.map(({ booking: b, originCityName, destinationCityName }) => {
      const origin = [b.originLocation, originCityName].filter(Boolean).join(" · ");
      const destination = [b.destinationLocation, destinationCityName].filter(Boolean).join(" · ");
      return {
        id: b.id,
        kind: "booking" as const,
        time: b.originAt ? b.originAt.slice(11, 16) : null,
        title: b.title,
        type: b.type,
        location: origin || destination ? `${origin} → ${destination}` : null,
        address: null,
        notes: b.confirmationCode ? `Código: ${b.confirmationCode}` : b.details,
        cityName: null,
        hasTicket: !!b.documentId,
        ticketDocumentId: b.documentId,
        reservation: null,
      };
    }),
    ...arrivals.map(({ booking: b, originCityName, destinationCityName }) => {
      const origin = [b.originLocation, originCityName].filter(Boolean).join(" · ");
      const destination = [b.destinationLocation, destinationCityName].filter(Boolean).join(" · ");
      return {
        id: b.id,
        kind: "booking" as const,
        time: b.destinationAt ? b.destinationAt.slice(11, 16) : null,
        title: `Chegada: ${b.title}`,
        type: b.type,
        location: destination || origin || null,
        address: null,
        notes: b.confirmationCode ? `Código: ${b.confirmationCode}` : b.details,
        cityName: null,
        hasTicket: !!b.documentId,
        ticketDocumentId: b.documentId,
        reservation: null,
      };
    }),
    ...lodgingEntries,
  ];

  entries.sort((a, b) => {
    if (a.time === b.time) return 0;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return a.time.localeCompare(b.time);
  });

  return { date: day, entries };
}
