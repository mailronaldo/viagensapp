import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/format";
import { TripCard } from "@/components/TripCard";
import { EmptyState, btnOutline, btnPrimary, type TagTone } from "@/components/ui";

export const metadata = { title: "Minhas viagens" };

// Busca sem diferenciar maiúsculas nem acentos ("sao paulo" acha "São Paulo").
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function daysLabel(days: number) {
  return days === 1 ? "Amanhã" : `Em ${days} dias`;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  // A agência (MASTER) é redirecionada para /agency; a área do cliente é só de clientes.
  const user = await requireClient();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const rows = await db
    .select({ trip: t.trips, role: t.tripMembers.role })
    .from(t.tripMembers)
    .innerJoin(t.trips, eq(t.trips.id, t.tripMembers.tripId))
    .where(eq(t.tripMembers.userId, user.id))
    .orderBy(desc(t.trips.startDate));

  const upcoming = rows
    .map(({ trip }) => daysBetween(todayIn(trip.timezone), trip.startDate))
    .filter((days) => days > 0);
  const nextIn = upcoming.length > 0 ? Math.min(...upcoming) : null;

  const needle = normalize(query);
  const visible = rows.filter(({ trip }) => normalize(`${trip.title} ${trip.destination}`).includes(needle));

  return (
    <>
      <div className="hero-bleed pb-10 pt-5 text-white">
        <h1 className="text-2xl font-semibold">Para onde vamos, {user.name.split(" ")[0]}?</h1>
        <p className="text-sm text-brand-100">
          {rows.length === 0
            ? "Comece cadastrando a sua primeira viagem."
            : `${rows.length} ${rows.length === 1 ? "viagem" : "viagens"}${
                nextIn === null ? "" : ` · a próxima começa ${nextIn === 1 ? "amanhã" : `em ${nextIn} dias`}`
              }`}
        </p>
      </div>

      <form
        action="/"
        className="relative -mt-6 mb-6 flex flex-wrap gap-1 rounded-2xl border-2 border-highlight bg-white p-1.5 shadow-lg shadow-brand-950/10"
      >
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Buscar viagem ou destino"
          aria-label="Buscar viagem ou destino"
          className="min-w-40 flex-1 rounded-xl px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none"
        />
        <button className={btnOutline}>Buscar</button>
        <Link href="/trips/new" className={`${btnPrimary} grow sm:grow-0`}>
          Nova viagem
        </Link>
      </form>

      {rows.length === 0 ? (
        <EmptyState>
          Você ainda não cadastrou nenhuma viagem.{" "}
          <Link href="/trips/new" className="font-medium text-brand-700 hover:underline">
            Criar a primeira
          </Link>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState>
          Nenhuma viagem encontrada para “{query}”.{" "}
          <Link href="/" className="font-medium text-brand-700 hover:underline">
            Ver todas
          </Link>
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(({ trip }) => {
            const today = todayIn(trip.timezone);
            const status: { label: string; tone: TagTone } =
              today < trip.startDate
                ? { label: daysLabel(daysBetween(today, trip.startDate)), tone: "info" }
                : today > trip.endDate
                  ? { label: "Concluída", tone: "neutral" }
                  : { label: "Em andamento", tone: "ok" };
            return (
              <li key={trip.id}>
                <TripCard
                  href={`/trips/${trip.id}`}
                  title={trip.title}
                  destination={trip.destination}
                  startDate={trip.startDate}
                  endDate={trip.endDate}
                  status={status}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
