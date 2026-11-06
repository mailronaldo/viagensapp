import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePanelAccess } from "@/lib/traveler-access";
import { ISO_DATE } from "@/lib/form";
import { addDays, formatDate, formatWeekday } from "@/lib/format";
import { getAgenda } from "@/services/agenda";
import { getDayPlan } from "@/services/itinerary";
import { listActivityTypes, listBookingTypes, listLodgingTypes, toNameMap } from "@/services/catalogs";
import { DayStrip } from "@/components/DayStrip";
import { TravelerAgenda } from "@/components/TravelerAgenda";
import { Card, EmptyState } from "@/components/ui";

export default async function TravelerDayPage({ params }: { params: Promise<{ id: string; date: string }> }) {
  const { id, date } = await params;
  const { trip } = await requirePanelAccess(id);
  if (!ISO_DATE.test(date) || date < trip.startDate || date > trip.endDate) notFound();

  const [agenda, plan, docs, activityTypes, bookingTypes, lodgingTypes] = await Promise.all([
    getAgenda(trip, date),
    getDayPlan(trip.id, date),
    db.select({ id: t.documents.id, fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.tripId, trip.id)),
    listActivityTypes(),
    listBookingTypes(),
    listLodgingTypes(),
  ]);
  const docName = new Map(docs.map((d) => [d.id, d.fileName]));
  const activityTypeName = toNameMap(activityTypes);
  const bookingTypeName = toNameMap(bookingTypes);
  const lodgingTypeName = toNameMap(lodgingTypes);
  const base = `/traveler/trips/${trip.id}`;
  const dayNumber = Math.round((Date.parse(date) - Date.parse(trip.startDate)) / 86_400_000) + 1;
  const prev = date > trip.startDate ? addDays(date, -1) : null;
  const next = date < trip.endDate ? addDays(date, 1) : null;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 text-sm">
        <Link href={base} className="text-slate-500 hover:underline">
          ← {trip.title}
        </Link>
        <div className="flex gap-4">
          {prev && (
            <Link href={`${base}/day/${prev}`} className="text-brand-700 hover:underline">
              ← Dia anterior
            </Link>
          )}
          {next && (
            <Link href={`${base}/day/${next}`} className="text-brand-700 hover:underline">
              Próximo dia →
            </Link>
          )}
        </div>
      </div>

      <DayStrip basePath={`${base}/day`} startDate={trip.startDate} endDate={trip.endDate} current={date} />

      <Card className="mb-6">
        <p className="text-xs font-medium uppercase text-slate-400">
          Dia {dayNumber} · {formatDate(date)}
        </p>
        <h1 className="text-xl font-semibold">
          <span className="inline-block first-letter:uppercase">{formatWeekday(date)}</span>
          {plan.title ? <span className="font-normal text-slate-500"> — {plan.title}</span> : null}
        </h1>
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

      <section>
        <h2 className="mb-3 font-medium">Agenda do dia</h2>
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
      </section>
    </>
  );
}
