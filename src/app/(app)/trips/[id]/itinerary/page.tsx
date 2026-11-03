import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { eachDay, formatDate, formatWeekday, todayIn } from "@/lib/format";
import { ITEM_TYPE_LABEL } from "@/lib/labels";
import { getAgenda } from "@/services/agenda";
import { ItemFields } from "@/components/TripFields";
import { addCityAction, deleteCityAction } from "@/app/actions/trips";
import { addItemAction, deleteItemAction } from "@/app/actions/items";
import {
  AddPanel,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  btnDanger,
  btnPrimary,
  inputCls,
} from "@/components/ui";

export default async function ItineraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string; error?: string }>;
}) {
  const { id } = await params;
  const { day, error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);

  const days = eachDay(trip.startDate, trip.endDate);
  const today = todayIn(trip.timezone);
  const selected =
    day && days.includes(day) ? day : days.includes(today) ? today : trip.startDate;

  const [cities, agenda, ticketDocs] = await Promise.all([
    db.select().from(t.cities).where(eq(t.cities.tripId, trip.id)).orderBy(asc(t.cities.position)),
    getAgenda(trip, selected),
    db.select({ id: t.documents.id, fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.tripId, trip.id)),
  ]);
  const docName = new Map(ticketDocs.map((d) => [d.id, d.fileName]));

  return (
    <>
      <ErrorBanner message={error} />

      {/* Cidades */}
      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium text-slate-700">Cidades</h2>
          {cities.length === 0 && (
            <span className="text-xs text-slate-400">Nenhuma cadastrada.</span>
          )}
          {cities.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-900"
            >
              {c.name}
              {c.arrival ? ` · ${formatDate(c.arrival, { day: "2-digit", month: "short" })}` : ""}
              {canWrite && (
                <form action={deleteCityAction.bind(null, trip.id, c.id)}>
                  <button aria-label={`Remover ${c.name}`} className="cursor-pointer text-teal-700 hover:text-rose-700">
                    ×
                  </button>
                </form>
              )}
            </span>
          ))}
        </div>
        {canWrite && (
          <AddPanel title="Adicionar cidade">
            <form action={addCityAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-4">
              <Field label="Cidade">
                <input name="name" required className={inputCls} />
              </Field>
              <Field label="País">
                <input name="country" className={inputCls} />
              </Field>
              <Field label="Chegada">
                <input name="arrival" type="date" min={trip.startDate} max={trip.endDate} className={inputCls} />
              </Field>
              <Field label="Saída">
                <input name="departure" type="date" min={trip.startDate} max={trip.endDate} className={inputCls} />
              </Field>
              <div className="sm:col-span-4">
                <button className={btnPrimary}>Salvar cidade</button>
              </div>
            </form>
          </AddPanel>
        )}
      </section>

      {/* Seletor de dia */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => {
          const active = d === selected;
          return (
            <Link
              key={d}
              href={`/trips/${trip.id}/itinerary?day=${d}`}
              className={`shrink-0 rounded-lg border px-3 py-2 text-center text-xs ${
                active
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-teal-600"
              }`}
            >
              <span className="block font-medium">Dia {i + 1}</span>
              <span className="block opacity-80">
                {formatDate(d, { day: "2-digit", month: "short" })}
              </span>
            </Link>
          );
        })}
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 font-medium capitalize">{formatWeekday(selected)}</h2>
        {agenda.entries.length === 0 ? (
          <EmptyState>Nada planejado para este dia.</EmptyState>
        ) : (
          <ol className="divide-y divide-slate-100">
            {agenda.entries.map((e) => (
              <li key={`${e.kind}-${e.id}`} className="flex gap-4 py-3">
                <span className="w-12 shrink-0 text-sm tabular-nums text-slate-500">
                  {e.time ?? "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {e.title}
                    {e.kind === "booking" && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal uppercase text-slate-500">
                        reserva
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {e.kind === "item"
                      ? ITEM_TYPE_LABEL[e.type as keyof typeof ITEM_TYPE_LABEL]
                      : "Reserva"}
                    {e.cityName ? ` · ${e.cityName}` : ""}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                  {e.address && <p className="text-xs text-slate-400">{e.address}</p>}
                  {e.notes && <p className="mt-1 text-xs text-slate-500">{e.notes}</p>}
                  {e.ticketDocumentId && (
                    <a
                      href={`/api/files/${trip.id}/${e.ticketDocumentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-teal-700 hover:underline"
                    >
                      📎 {docName.get(e.ticketDocumentId) ?? "Ingresso"}
                    </a>
                  )}
                </div>
                {canWrite && (
                  <div className="flex shrink-0 items-start gap-3">
                    <Link
                      href={
                        e.kind === "item"
                          ? `/trips/${trip.id}/itinerary/items/${e.id}`
                          : `/trips/${trip.id}/bookings/${e.id}`
                      }
                      className="text-xs text-teal-700 hover:underline"
                    >
                      Editar
                    </Link>
                    {e.kind === "item" && (
                      <form action={deleteItemAction.bind(null, trip.id, e.id, selected)}>
                        <button className={btnDanger}>Remover</button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {canWrite && (
        <AddPanel title="Adicionar atividade" defaultOpen={agenda.entries.length === 0}>
          <form
            action={addItemAction.bind(null, trip.id)}
            className="grid gap-3 sm:grid-cols-6"
          >
            <ItemFields trip={trip} cities={cities} defaultDate={selected} />
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Salvar atividade</button>
            </div>
          </form>
        </AddPanel>
      )}
    </>
  );
}
