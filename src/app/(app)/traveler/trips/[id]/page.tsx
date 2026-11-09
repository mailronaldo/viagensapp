import Link from "next/link";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePanelAccess } from "@/lib/traveler-access";
import { formatDate, formatDateTime, formatWeekday, todayIn } from "@/lib/format";
import { getAgenda } from "@/services/agenda";
import { getItinerarySummary } from "@/services/itinerary";
import { listActivityTypes, listBookingTypes, listDocumentTypes, listLodgingTypes, toNameMap } from "@/services/catalogs";
import { listLegsForBookings } from "@/services/booking-legs";
import { listVouchersForLodgings } from "@/services/lodging-vouchers";
import { TravelerAgenda } from "@/components/TravelerAgenda";
import { Card, EmptyState, Hero } from "@/components/ui";

export const metadata = { title: "Painel da viagem" };

export default async function TravelerTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, kind, travelerId } = await requirePanelAccess(id);

  const today = todayIn(trip.timezone);
  const inTrip = today >= trip.startDate && today <= trip.endDate;
  const agendaDay = inTrip ? today : trip.startDate;

  // Viajante: documentos do grupo e os dele. Dono vendo o painel: todos (para conferir).
  const docFilter =
    kind === "traveler"
      ? and(
          eq(t.documents.tripId, trip.id),
          or(
            eq(t.documents.visibility, "GROUP"),
            and(eq(t.documents.visibility, "TRAVELER"), eq(t.documents.travelerId, travelerId!)),
          ),
        )
      : eq(t.documents.tripId, trip.id);

  const [days, agenda, transports, lodgings, group, docs, allDocs, documentTypes, bookingTypes, activityTypes, lodgingTypes] = await Promise.all([
    getItinerarySummary(trip),
    getAgenda(trip, agendaDay),
    db.select().from(t.bookings).where(eq(t.bookings.tripId, trip.id)).orderBy(asc(t.bookings.title)),
    db.select().from(t.lodgings).where(eq(t.lodgings.tripId, trip.id)).orderBy(sql`${t.lodgings.checkInDate} asc nulls last`),
    db
      .select({ name: t.travelers.name })
      .from(t.tripTravelers)
      .innerJoin(t.travelers, eq(t.travelers.id, t.tripTravelers.travelerId))
      .where(eq(t.tripTravelers.tripId, trip.id))
      .orderBy(asc(t.travelers.name)),
    db.select().from(t.documents).where(docFilter).orderBy(asc(t.documents.title)),
    db.select({ id: t.documents.id, fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.tripId, trip.id)),
    listDocumentTypes(),
    listBookingTypes(),
    listActivityTypes(),
    listLodgingTypes(),
  ]);
  const docName = new Map(allDocs.map((d) => [d.id, d.fileName]));
  const docTypeName = toNameMap(documentTypes);
  const bookingTypeName = toNameMap(bookingTypes);
  const activityTypeName = toNameMap(activityTypes);
  const lodgingTypeName = toNameMap(lodgingTypes);
  const base = `/traveler/trips/${trip.id}`;
  const legsByBooking = await listLegsForBookings(transports.map((b) => b.id));
  const vouchersByLodging = await listVouchersForLodgings(lodgings.map((l) => l.id));
  const legCityIds = [...legsByBooking.values()].flat().flatMap((leg) => [leg.originCityId, leg.destinationCityId]).filter((v): v is string => !!v);
  const legCities = legCityIds.length ? await db.select().from(t.cities).where(inArray(t.cities.id, legCityIds)) : [];
  const legCityName = toNameMap(legCities);

  return (
    <>
      <Hero>
        {kind === "traveler" && (
          <Link href="/traveler" className="text-xs text-brand-100 hover:underline">
            ← Minhas viagens
          </Link>
        )}
        <h1 className="mt-1 text-2xl font-semibold">{trip.title}</h1>
        <p className="text-sm text-brand-100">
          {trip.destination} · {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
        </p>
        {group.length > 0 && <p className="mt-1 text-xs text-brand-100">Grupo: {group.map((g) => g.name).join(", ")}</p>}
        {trip.notes && <p className="mt-2 whitespace-pre-line text-sm">{trip.notes}</p>}
      </Hero>

      {kind === "member" && (
        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          Você está vendo o painel como o viajante o enxerga (somente leitura, sem custos).{" "}
          <Link href={`/trips/${trip.id}`} className="font-medium underline">
            ← Voltar à viagem
          </Link>
        </div>
      )}

      <Card className="mb-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium">
            {inTrip ? "Agenda de hoje" : "Primeiro dia"}
            <span className="ml-2 text-sm font-normal inline-block first-letter:uppercase text-slate-500">{formatWeekday(agenda.date)}</span>
          </h2>
          <Link href={`${base}/day/${agenda.date}`} className="text-sm text-brand-700 hover:underline">
            Abrir o dia
          </Link>
        </div>
        {agenda.entries.length === 0 ? (
          <EmptyState>Nada planejado para este dia.</EmptyState>
        ) : (
          <TravelerAgenda
            tripId={trip.id}
            entries={agenda.entries}
            docName={docName}
            activityTypeName={activityTypeName}
            bookingTypeName={bookingTypeName}
            lodgingTypeName={lodgingTypeName}
          />
        )}
      </Card>

      <h2 className="mb-3 font-medium">Roteiro resumido</h2>
      <ol className="mb-8 space-y-3">
        {days.map((d) => (
          <li key={d.date}>
            <Link href={`${base}/day/${d.date}`} className="block">
              <Card className="flex gap-4 transition-colors hover:border-brand-500">
                <div className="w-16 shrink-0 text-center">
                  <p className="text-xs font-medium uppercase text-slate-400">Dia {d.number}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatDate(d.date, { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {d.cities.map((c) => (
                      <span key={c.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-900">
                        📍 {c.name}
                      </span>
                    ))}
                    {d.date === today && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-800">
                        hoje
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 font-medium ${d.title ? "" : "text-slate-400"}`}>{d.title ?? "Sem título"}</p>
                  {d.summary && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{d.summary}</p>}
                </div>
                <p className="shrink-0 text-xs text-brand-700">Ver o dia →</p>
              </Card>
            </Link>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 font-medium">Transportes</h2>
          {transports.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum transporte cadastrado.</p>
          ) : (
            <ul className="space-y-2">
              {transports.map((b) => {
                const legs = legsByBooking.get(b.id) ?? [];
                return (
                  <li key={b.id}>
                    <Card className="p-4">
                      <p className="text-sm font-medium">
                        {b.title}{" "}
                        <span className="text-xs font-normal text-slate-500">{bookingTypeName[b.type]}</span>
                      </p>
                      {legs.length === 0 ? (
                        <p className="text-xs text-slate-600">Sem data</p>
                      ) : (
                        legs.map((leg) => (
                          <div key={leg.id}>
                            <p className="text-xs text-slate-600">
                              {leg.originAt ? formatDateTime(leg.originAt) : "Sem data"}
                              {leg.destinationAt ? ` → ${formatDateTime(leg.destinationAt)}` : ""}
                            </p>
                            {(leg.originLocation || leg.originCityId || leg.destinationLocation || leg.destinationCityId) && (
                              <p className="text-xs text-slate-600">
                                {[leg.originLocation, leg.originCityId ? legCityName[leg.originCityId] : null].filter(Boolean).join(" · ")}
                                {" → "}
                                {[leg.destinationLocation, leg.destinationCityId ? legCityName[leg.destinationCityId] : null].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                      {b.confirmationCode && (
                        <p className="text-xs text-slate-500">
                          Confirmação: <span className="font-mono">{b.confirmationCode}</span>
                        </p>
                      )}
                      {b.documentId && (
                        <a href={`/api/files/${trip.id}/${b.documentId}`} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">
                          📎 {docName.get(b.documentId) ?? "Voucher"}
                        </a>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-medium">Hospedagens</h2>
          {lodgings.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma hospedagem cadastrada.</p>
          ) : (
            <ul className="space-y-2">
              {lodgings.map((l) => (
                <li key={l.id}>
                  <Card className="p-4">
                    <p className="text-sm font-medium">
                      {l.name}{" "}
                      <span className="text-xs font-normal text-slate-500">{lodgingTypeName[l.type]}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      {l.checkInDate ? formatDate(l.checkInDate) : "—"}
                      {l.checkInTime ? ` · ${l.checkInTime}` : ""} →{" "}
                      {l.checkOutDate ? formatDate(l.checkOutDate) : "—"}
                      {l.checkOutTime ? ` · ${l.checkOutTime}` : ""}
                    </p>
                    {l.address && <p className="text-xs text-slate-500">{l.address}</p>}
                    {(vouchersByLodging.get(l.id) ?? []).map((v, i) => (
                      <div key={i} className="mt-1 text-xs text-slate-500">
                        {v.confirmationCode && (
                          <p>
                            Confirmação ({v.name}): <span className="font-mono">{v.confirmationCode}</span>
                          </p>
                        )}
                        {v.voucherDocumentId && (
                          <a
                            href={`/api/files/${trip.id}/${v.voucherDocumentId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-700 hover:underline"
                          >
                            📎 {docName.get(v.voucherDocumentId) ?? "Voucher"}
                          </a>
                        )}
                      </div>
                    ))}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-medium">Documentos</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum documento liberado para você ainda.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {docs.map((d) => (
              <li key={d.id}>
                <Card className="p-4">
                  <a href={`/api/files/${trip.id}/${d.id}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-brand-800 hover:underline">
                    {d.title}
                  </a>
                  <p className="text-xs text-slate-500">
                    {docTypeName[d.type] ?? d.type}
                    {kind === "member" ? ` · ${d.visibility === "OWNER" ? "só o dono" : d.visibility === "GROUP" ? "grupo" : "um viajante"}` : ""}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
