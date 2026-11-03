import Link from "next/link";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDateTime, formatMoney, formatWeekday, todayIn } from "@/lib/format";
import { BOOKING_TYPE_LABEL, ITEM_TYPE_LABEL, LODGING_TYPE_LABEL } from "@/lib/labels";
import { getAgenda } from "@/services/agenda";
import { getExpenseSummary } from "@/services/expenses";
import { deleteTripAction } from "@/app/actions/trips";
import { linkTravelerAction, unlinkTravelerAction } from "@/app/actions/travelers";
import { Card, EmptyState, btnDanger, btnGhost, inputCls } from "@/components/ui";

export default async function TripOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { trip, role, canWrite } = await requireTripAccess(id);

  const today = todayIn(trip.timezone);
  const inTrip = today >= trip.startDate && today <= trip.endDate;
  const agendaDay = inTrip ? today : trip.startDate;

  const [agenda, summary, upcoming, linked, ownerTravelers] = await Promise.all([
    getAgenda(trip, agendaDay),
    getExpenseSummary(trip.id, trip.baseCurrency),
    db
      .select()
      .from(t.bookings)
      .where(
        and(
          eq(t.bookings.tripId, trip.id),
          gte(t.bookings.startAt, `${today} 00:00:00`),
        ),
      )
      .orderBy(asc(t.bookings.startAt))
      .limit(4),
    db
      .select({ id: t.travelers.id, name: t.travelers.name })
      .from(t.tripTravelers)
      .innerJoin(t.travelers, eq(t.travelers.id, t.tripTravelers.travelerId))
      .where(eq(t.tripTravelers.tripId, trip.id))
      .orderBy(asc(t.travelers.name)),
    // Viajantes do cliente dono da viagem (candidatos a entrar no grupo).
    db
      .select({ id: t.travelers.id, name: t.travelers.name })
      .from(t.travelers)
      .where(eq(t.travelers.clientId, trip.ownerId))
      .orderBy(asc(t.travelers.name)),
  ]);
  const linkedIds = new Set(linked.map((l) => l.id));
  const available = ownerTravelers.filter((tr) => !linkedIds.has(tr.id));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium">
            {inTrip ? "Agenda de hoje" : "Primeiro dia"}
            <span className="ml-2 text-sm font-normal capitalize text-slate-500">
              {formatWeekday(agenda.date)}
            </span>
          </h2>
          <Link
            href={`/trips/${trip.id}/itinerary/day/${agenda.date}`}
            className="text-sm text-teal-700 hover:underline"
          >
            Ver roteiro
          </Link>
        </div>
        {agenda.entries.length === 0 ? (
          <EmptyState>Nada planejado para este dia ainda.</EmptyState>
        ) : (
          <ol className="divide-y divide-slate-100">
            {agenda.entries.map((e) => (
              <li key={`${e.kind}-${e.id}`} className="flex gap-4 py-3">
                <span className="w-12 shrink-0 text-sm tabular-nums text-slate-500">
                  {e.time ?? "—"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {e.kind === "booking"
                      ? BOOKING_TYPE_LABEL[e.type as keyof typeof BOOKING_TYPE_LABEL]
                      : e.kind === "lodging"
                        ? LODGING_TYPE_LABEL[e.type as keyof typeof LODGING_TYPE_LABEL]
                        : ITEM_TYPE_LABEL[e.type as keyof typeof ITEM_TYPE_LABEL]}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="space-y-6">
        <Card>
          <h2 className="mb-2 font-medium">Custos</h2>
          <p className="text-2xl font-semibold tabular-nums">
            {formatMoney(summary.totalBase, summary.baseCurrency)}
          </p>
          {summary.unconvertedCount > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              {summary.unconvertedCount} lançamento(s) em outra moeda sem cotação ficaram fora do total.
            </p>
          )}
          <Link
            href={`/trips/${trip.id}/expenses`}
            className="mt-3 inline-block text-sm text-teal-700 hover:underline"
          >
            Abrir central de custos
          </Link>
        </Card>

        <Card>
          <h2 className="mb-2 font-medium">Próximos transportes</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum transporte futuro cadastrado.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((b) => (
                <li key={b.id} className="text-sm">
                  <p className="font-medium">{b.title}</p>
                  <p className="text-xs text-slate-500">
                    {BOOKING_TYPE_LABEL[b.type]} · {formatDateTime(b.startAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-medium">Viajantes ({linked.length})</h2>
          {linked.length === 0 ? (
            <p className="text-sm text-slate-500">Ninguém no grupo desta viagem ainda.</p>
          ) : (
            <ul className="space-y-1">
              {linked.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <span>{l.name}</span>
                  {canWrite && (
                    <form action={unlinkTravelerAction.bind(null, trip.id, l.id)}>
                      <button className={btnDanger}>Remover</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canWrite && available.length > 0 && (
            <form action={linkTravelerAction.bind(null, trip.id)} className="mt-3 flex gap-2">
              <select name="travelerId" required defaultValue="" className={inputCls}>
                <option value="" disabled>
                  Incluir viajante…
                </option>
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button className={btnGhost}>Incluir</button>
            </form>
          )}
          {canWrite && ownerTravelers.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Cadastre pessoas em{" "}
              <Link href="/travelers" className="text-teal-700 hover:underline">
                Viajantes
              </Link>{" "}
              para incluí-las aqui.
            </p>
          )}
        </Card>

        {trip.notes && (
          <Card>
            <h2 className="mb-2 font-medium">Observações</h2>
            <p className="whitespace-pre-line text-sm text-slate-600">{trip.notes}</p>
          </Card>
        )}

        {role === "OWNER" && (
          <form action={deleteTripAction.bind(null, trip.id)}>
            <button className={btnDanger}>Excluir esta viagem</button>
          </form>
        )}
      </div>
    </div>
  );
}
