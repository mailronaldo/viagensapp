import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Pencil } from "lucide-react";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { ISO_DATE } from "@/lib/form";
import { addDays, formatDate, formatMoney, formatWeekday } from "@/lib/format";
import { getAgenda } from "@/services/agenda";
import { getDayPlan } from "@/services/itinerary";
import { getTripCities } from "@/services/cities";
import {
  LEGACY_ACTIVITY_TYPE_IDS,
  LEGACY_BOOKING_TYPE_IDS,
  listActivityTypes,
  listBookingTypes,
  listLodgingTypes,
  listReservationMethods,
  toNameMap,
} from "@/services/catalogs";
import { addItemAction, deleteItemAction, removeReservationAction } from "@/app/actions/items";
import { addBookingAction } from "@/app/actions/bookings";
import { addLodgingAction } from "@/app/actions/lodgings";
import { DayStrip } from "@/components/DayStrip";
import { BookingFields, ItemFields, LodgingFields } from "@/components/TripFields";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { EditDaySummaryButton } from "@/components/EditDaySummaryButton";
import {
  AddPanel,
  Card,
  EmptyState,
  ErrorBanner,
  btnDanger,
  btnPrimary,
  tagCls,
} from "@/components/ui";

export default async function ItineraryDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; date: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, date } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!ISO_DATE.test(date) || date < trip.startDate || date > trip.endDate) notFound();

  const [cities, activityTypes, bookingTypes, lodgingTypes, reservationMethods, agenda, plan, docs] = await Promise.all([
    getTripCities(trip.id),
    listActivityTypes(),
    listBookingTypes(),
    listLodgingTypes(),
    listReservationMethods(),
    getAgenda(trip, date),
    getDayPlan(trip.id, date),
    db.select({ id: t.documents.id, fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.tripId, trip.id)),
  ]);
  const docName = new Map(docs.map((d) => [d.id, d.fileName]));
  const activityTypeName = toNameMap(activityTypes);
  const bookingTypeName = toNameMap(bookingTypes);
  const lodgingTypeName = toNameMap(lodgingTypes);
  const dayNumber = Math.round((Date.parse(date) - Date.parse(trip.startDate)) / 86_400_000) + 1;
  const prev = date > trip.startDate ? addDays(date, -1) : null;
  const next = date < trip.endDate ? addDays(date, 1) : null;
  const base = `/trips/${trip.id}/itinerary`;
  const planCityIds = new Set(plan.cities.map((c) => c.id));

  return (
    <>
      <ErrorBanner message={error} />

      <div className="mb-4 flex items-center justify-between gap-3 text-sm">
        <Link href={base} className="text-slate-500 hover:underline">
          ← Roteiro resumido
        </Link>
        <div className="flex gap-4">
          {prev ? (
            <Link href={`${base}/day/${prev}`} className="text-brand-700 hover:underline">
              ← Dia anterior
            </Link>
          ) : null}
          {next ? (
            <Link href={`${base}/day/${next}`} className="text-brand-700 hover:underline">
              Próximo dia →
            </Link>
          ) : null}
        </div>
      </div>

      <DayStrip basePath={`${base}/day`} startDate={trip.startDate} endDate={trip.endDate} current={date} />

      <Card className="relative mb-6">
        {canWrite && (
          <EditDaySummaryButton
            tripId={trip.id}
            date={date}
            title={plan.title}
            summary={plan.summary}
            cities={cities}
            planCityIds={[...planCityIds]}
          />
        )}
        <p className="text-xs font-medium uppercase text-slate-400">
          Dia {dayNumber} · {formatDate(date)}
        </p>
        <h2 className="pr-8 text-xl font-semibold">
          <span className="inline-block first-letter:uppercase">{formatWeekday(date)}</span>
          {plan.title ? <span className="font-normal text-slate-500"> — {plan.title}</span> : null}
        </h2>
        {plan.cities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.cities.map((c) => (
              <span key={c.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-900">
                📍 {c.name}
              </span>
            ))}
          </div>
        )}
        {plan.summary && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{plan.summary}</p>}
      </Card>

      <section className="mb-6">
        <h3 className="mb-3 font-medium">Agenda do dia</h3>
        {agenda.entries.length === 0 ? (
          <EmptyState>Nada planejado para este dia.</EmptyState>
        ) : (
          <ol className="space-y-2">
            {agenda.entries.map((e) => (
              <li key={`${e.kind}-${e.id}`} className="flex gap-3">
                <span className="w-12 shrink-0 pt-3 text-sm font-medium tabular-nums">
                  {e.time ?? "—"}
                  {e.endTime && <span className="block text-xs font-normal text-slate-400">–{e.endTime}</span>}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap justify-between gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {e.kind === "item"
                      ? activityTypeName[e.type]
                      : e.kind === "lodging"
                        ? lodgingTypeName[e.type]
                        : bookingTypeName[e.type]}
                    {e.cityName ? ` · ${e.cityName}` : ""}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                  {e.reservation && (
                    <div className="text-xs text-emerald-800">
                      Reserva:{" "}
                      {[
                        e.reservation.provider,
                        e.reservation.code ? `cód. ${e.reservation.code}` : null,
                        e.reservation.price && e.reservation.currency
                          ? formatMoney(e.reservation.price, e.reservation.currency)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "dados no detalhe"}{" "}
                      <Link href={`${base}/items/${e.id}#reserva`} className="underline">
                        ver / editar
                      </Link>
                      {canWrite && (
                        <form action={removeReservationAction.bind(null, trip.id, e.id, "day")} className="ml-2 inline">
                          <button className={btnDanger}>excluir reserva</button>
                        </form>
                      )}
                    </div>
                  )}
                  {e.address && <p className="text-xs text-slate-400">{e.address}</p>}
                  {e.notes && <p className="mt-1 text-xs text-slate-500">{e.notes}</p>}
                  {e.ticketDocumentId && (
                    <a
                      href={`/api/files/${trip.id}/${e.ticketDocumentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-brand-700 hover:underline"
                    >
                      📎 {docName.get(e.ticketDocumentId) ?? "Ingresso"}
                    </a>
                  )}
                </div>
                <div className="flex w-full flex-col items-end gap-2 sm:w-auto sm:shrink-0">
                  {canWrite && (
                    <div className="flex items-center gap-1">
                      <Link
                        href={
                          e.kind === "item"
                            ? `${base}/items/${e.id}?day=${date}`
                            : e.kind === "lodging"
                              ? `/trips/${trip.id}/lodgings/${e.id}?day=${date}`
                              : `/trips/${trip.id}/transports/${e.id}?day=${date}`
                        }
                        aria-label="Editar"
                        title="Editar"
                        className="flex size-7 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50"
                      >
                        <Pencil className="size-4" />
                      </Link>
                      {e.kind === "item" && (
                        <ConfirmDeleteButton
                          label="Remover"
                          confirmTitle="Remover esta atividade?"
                          confirmDescription="Isso remove a atividade, a reserva, os ingressos, passes, pontos de interesse, tips e região cadastrados nela. Não dá pra desfazer."
                          deleteAction={deleteItemAction.bind(null, trip.id, e.id, date)}
                          size="sm"
                        />
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {e.kind === "booking" && (
                      <Link
                        href={`/trips/${trip.id}/transports/${e.id}`}
                        className={`${tagCls("info")} hover:bg-brand-100`}
                      >
                        transporte
                      </Link>
                    )}
                    {e.kind === "lodging" && (
                      <Link
                        href={`/trips/${trip.id}/lodgings/${e.id}`}
                        className={`${tagCls("info")} hover:bg-brand-100`}
                      >
                        hospedagem
                      </Link>
                    )}
                    {e.kind === "item" && e.type !== "FREE_TIME" && (
                      <Link
                        href={`${base}/items/${e.id}#reserva`}
                        className={`${tagCls(e.reservation ? "ok" : "warn")} ${
                          e.reservation ? "hover:bg-emerald-200" : "hover:bg-amber-200"
                        }`}
                      >
                        {e.reservation ? "reservado" : "sem reserva"}
                      </Link>
                    )}
                  </div>
                </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {canWrite && (
        <div className="space-y-3">
          <AddPanel title="Adicionar atividade" defaultOpen={agenda.entries.length === 0}>
            <form action={addItemAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
              <input type="hidden" name="day" value={date} />
              <ItemFields
                trip={trip}
                cities={cities}
                types={activityTypes.filter((ty) => !LEGACY_ACTIVITY_TYPE_IDS.includes(ty.id))}
                defaultDate={date}
              />
              <div className="sm:col-span-6">
                <button className={btnPrimary}>Salvar atividade</button>
              </div>
            </form>
          </AddPanel>

          <AddPanel title="Adicionar transporte">
            <form action={addBookingAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
              <input type="hidden" name="day" value={date} />
              <BookingFields
                trip={trip}
                cities={cities}
                types={bookingTypes.filter((ty) => !LEGACY_BOOKING_TYPE_IDS.includes(ty.id))}
                defaultDate={date}
              />
              <div className="sm:col-span-6">
                <button className={btnPrimary}>Salvar transporte</button>
              </div>
            </form>
          </AddPanel>

          <AddPanel title="Adicionar hospedagem">
            <form action={addLodgingAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
              <input type="hidden" name="day" value={date} />
              <LodgingFields trip={trip} cities={cities} types={lodgingTypes} methods={reservationMethods} defaultDate={date} />
              <div className="sm:col-span-6">
                <button className={btnPrimary}>Salvar hospedagem</button>
              </div>
            </form>
          </AddPanel>
        </div>
      )}
    </>
  );
}
