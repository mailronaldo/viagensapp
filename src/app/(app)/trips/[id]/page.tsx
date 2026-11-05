import Link from "next/link";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDate, formatDateTime, formatMoney, formatWeekday, todayIn } from "@/lib/format";
import { BOOKING_TYPE_LABEL } from "@/lib/labels";
import { getItinerarySummary } from "@/services/itinerary";
import { getExpenseSummary } from "@/services/expenses";
import { deleteTripAction } from "@/app/actions/trips";
import { Card, btnDanger } from "@/components/ui";

export default async function TripDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { trip, role, canWrite } = await requireTripAccess(id);

  const today = todayIn(trip.timezone);

  const [days, summary, upcoming, linked] = await Promise.all([
    getItinerarySummary(trip),
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
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Roteiro resumido</h2>
        <ol className="space-y-3">
          {days.map((d) => {
            const href = `/trips/${trip.id}/itinerary/day/${d.date}`;
            return (
              <li key={d.date}>
                <Link href={href} className="block">
                  <Card className="flex gap-4 transition-colors hover:border-brand-500">
                    <div className="w-16 shrink-0 text-center">
                      <p className="text-xs font-medium uppercase text-slate-400">Dia {d.number}</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatDate(d.date, { day: "2-digit", month: "short" })}
                      </p>
                      <p className="text-xs inline-block first-letter:uppercase text-slate-500">
                        {formatWeekday(d.date).split(",")[0]}
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
                      <p className={`mt-1 font-medium ${d.title ? "" : "text-slate-400"}`}>
                        {d.title ?? "Sem título"}
                      </p>
                      {d.summary && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{d.summary}</p>}
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-500">
                      <p>
                        {d.activityCount === 0
                          ? "Sem atividades"
                          : `${d.activityCount} atividade${d.activityCount > 1 ? "s" : ""}`}
                      </p>
                      <p className="mt-1 text-brand-700">Ver o dia →</p>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

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
            className="mt-3 inline-block text-sm text-brand-700 hover:underline"
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
            <ul className="space-y-1 text-sm">
              {linked.map((l) => (
                <li key={l.id}>{l.name}</li>
              ))}
            </ul>
          )}
          <Link href={`/trips/${trip.id}/travelers`} className="mt-3 inline-block text-sm text-brand-700 hover:underline">
            {canWrite ? "Gerenciar viajantes" : "Ver viajantes"}
          </Link>
          <Link href={`/traveler/trips/${trip.id}`} className="mt-2 block text-sm text-brand-700 hover:underline">
            Ver o painel do viajante (como eles veem)
          </Link>
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
