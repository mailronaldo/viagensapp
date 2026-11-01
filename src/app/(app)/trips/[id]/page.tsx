import Link from "next/link";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDateTime, formatMoney, formatWeekday, todayIn } from "@/lib/format";
import { BOOKING_TYPE_LABEL, ITEM_TYPE_LABEL } from "@/lib/labels";
import { getAgenda } from "@/services/agenda";
import { getExpenseSummary } from "@/services/expenses";
import { deleteTripAction } from "@/app/actions/trips";
import { Card, EmptyState, btnDanger } from "@/components/ui";

export default async function TripOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { trip, role } = await requireTripAccess(id);

  const today = todayIn(trip.timezone);
  const inTrip = today >= trip.startDate && today <= trip.endDate;
  const agendaDay = inTrip ? today : trip.startDate;

  const [agenda, summary, upcoming] = await Promise.all([
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
  ]);

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
            href={`/trips/${trip.id}/itinerary?day=${agenda.date}`}
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
          <h2 className="mb-2 font-medium">Próximas reservas</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma reserva futura cadastrada.</p>
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
