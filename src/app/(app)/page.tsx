import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatDate, todayIn } from "@/lib/format";
import { EmptyState, btnPrimary } from "@/components/ui";

export const metadata = { title: "Minhas viagens" };

export default async function HomePage() {
  const user = await requireUser();

  const rows = await db
    .select({ trip: t.trips, role: t.tripMembers.role })
    .from(t.tripMembers)
    .innerJoin(t.trips, eq(t.trips.id, t.tripMembers.tripId))
    .where(eq(t.tripMembers.userId, user.id))
    .orderBy(desc(t.trips.startDate));

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Minhas viagens</h1>
        <Link href="/trips/new" className={btnPrimary}>
          Nova viagem
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState>
          Você ainda não cadastrou nenhuma viagem.{" "}
          <Link href="/trips/new" className="font-medium text-teal-700 hover:underline">
            Criar a primeira
          </Link>
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map(({ trip }) => {
            const today = todayIn(trip.timezone);
            const status =
              today < trip.startDate
                ? "Planejada"
                : today > trip.endDate
                  ? "Concluída"
                  : "Em andamento";
            return (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-600 hover:shadow"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="font-medium">{trip.title}</h2>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        status === "Em andamento"
                          ? "bg-teal-100 text-teal-800"
                          : status === "Planejada"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{trip.destination}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
