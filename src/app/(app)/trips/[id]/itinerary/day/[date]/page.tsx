import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { ISO_DATE } from "@/lib/form";
import { addDays, formatDate, formatMoney, formatWeekday } from "@/lib/format";
import { BOOKING_TYPE_LABEL, ITEM_TYPE_LABEL, LODGING_TYPE_LABEL } from "@/lib/labels";
import { getAgenda } from "@/services/agenda";
import { getDayPlan } from "@/services/itinerary";
import { addItemAction, deleteItemAction, removeReservationAction } from "@/app/actions/items";
import { saveDayAction } from "@/app/actions/days";
import { DayStrip } from "@/components/DayStrip";
import { ItemFields } from "@/components/TripFields";
import {
  AddPanel,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  btnDanger,
  btnPrimary,
  inputCls,
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

  const [cities, agenda, plan, docs] = await Promise.all([
    db.select({ id: t.cities.id, name: t.cities.name }).from(t.cities).where(eq(t.cities.tripId, trip.id)).orderBy(asc(t.cities.position)),
    getAgenda(trip, date),
    getDayPlan(trip.id, date),
    db.select({ id: t.documents.id, fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.tripId, trip.id)),
  ]);
  const docName = new Map(docs.map((d) => [d.id, d.fileName]));
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

      <Card className="mb-6">
        <p className="text-xs font-medium uppercase text-slate-400">
          Dia {dayNumber} · {formatDate(date)}
        </p>
        <h2 className="text-xl font-semibold">
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
        {canWrite && (
          <div className="mt-3">
            <AddPanel title="Editar resumo do dia">
              <form action={saveDayAction.bind(null, trip.id, date)} className="grid gap-3">
                <Field label="Título do dia">
                  <input name="title" maxLength={120} defaultValue={plan.title ?? ""} placeholder="Ex.: Chegada e Alfama" className={inputCls} />
                </Field>
                <Field label="Descrição breve">
                  <textarea name="summary" rows={3} maxLength={1000} defaultValue={plan.summary ?? ""} className={inputCls} />
                </Field>
                <fieldset>
                  <legend className="mb-1 text-xs font-medium text-slate-600">Cidades neste dia</legend>
                  {cities.length === 0 ? (
                    <p className="text-xs text-slate-400">Cadastre as cidades na tela do roteiro resumido.</p>
                  ) : (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {cities.map((c) => (
                        <label key={c.id} className="inline-flex items-center gap-1.5 text-sm">
                          <input type="checkbox" name="cityIds" value={c.id} defaultChecked={planCityIds.has(c.id)} />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
                <div>
                  <button className={btnPrimary}>Salvar resumo</button>
                </div>
              </form>
            </AddPanel>
          </div>
        )}
      </Card>

      <section className="mb-6">
        <h3 className="mb-3 font-medium">Agenda do dia</h3>
        {agenda.entries.length === 0 ? (
          <EmptyState>Nada planejado para este dia.</EmptyState>
        ) : (
          <ol className="space-y-2">
            {agenda.entries.map((e) => (
              <li key={`${e.kind}-${e.id}`} className="flex gap-3">
                <span className="w-12 shrink-0 pt-3 text-sm font-medium tabular-nums">{e.time ?? "—"}</span>
                <div className="flex min-w-0 flex-1 flex-wrap justify-between gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {e.kind === "item"
                      ? ITEM_TYPE_LABEL[e.type as keyof typeof ITEM_TYPE_LABEL]
                      : e.kind === "lodging"
                        ? LODGING_TYPE_LABEL[e.type as keyof typeof LODGING_TYPE_LABEL]
                        : BOOKING_TYPE_LABEL[e.type as keyof typeof BOOKING_TYPE_LABEL]}
                    {e.cityName ? ` · ${e.cityName}` : ""}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                  {e.reservation && (
                    <p className="text-xs text-emerald-800">
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
                    </p>
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
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:flex-col sm:items-end">
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
                  {canWrite && (
                  <div className="flex items-center gap-3">
                    <Link
                      href={
                        e.kind === "item"
                          ? `${base}/items/${e.id}`
                          : e.kind === "lodging"
                            ? `/trips/${trip.id}/lodgings/${e.id}`
                            : `/trips/${trip.id}/transports/${e.id}`
                      }
                      className="text-xs text-brand-700 hover:underline"
                    >
                      Editar
                    </Link>
                    {e.kind === "item" && (
                      <form action={deleteItemAction.bind(null, trip.id, e.id, date)}>
                        <button className={btnDanger}>Remover</button>
                      </form>
                    )}
                  </div>
                )}
                </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {canWrite && (
        <AddPanel title="Adicionar atividade" defaultOpen={agenda.entries.length === 0}>
          <form action={addItemAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
            <input type="hidden" name="day" value={date} />
            <ItemFields trip={trip} cities={cities} defaultDate={date} />
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Salvar atividade</button>
            </div>
          </form>
        </AddPanel>
      )}
    </>
  );
}
