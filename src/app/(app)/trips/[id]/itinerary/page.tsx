import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { ISO_DATE } from "@/lib/form";
import { formatDate, formatWeekday, todayIn } from "@/lib/format";
import { getItinerarySummary } from "@/services/itinerary";
import { Card, ErrorBanner } from "@/components/ui";

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

  // Links antigos (?day=AAAA-MM-DD) levam direto ao dia.
  if (day && ISO_DATE.test(day) && day >= trip.startDate && day <= trip.endDate) {
    redirect(`/trips/${trip.id}/itinerary/day/${day}`);
  }

  const today = todayIn(trip.timezone);
  const [cities, days] = await Promise.all([
    db.select({ id: t.cities.id }).from(t.cities).where(eq(t.cities.tripId, trip.id)),
    getItinerarySummary(trip),
  ]);

  return (
    <>
      <ErrorBanner message={error} />

      {cities.length === 0 && (
        <p className="mb-6 text-sm text-slate-500">
          Nenhuma cidade cadastrada ainda.{" "}
          <Link href={`/trips/${trip.id}/cities`} className="text-brand-700 hover:underline">
            Cadastre as cidades da viagem
          </Link>{" "}
          antes de montar os dias.
        </p>
      )}

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
    </>
  );
}
