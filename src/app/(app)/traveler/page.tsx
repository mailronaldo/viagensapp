import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui";

export const metadata = { title: "Minhas viagens" };

export default async function TravelerHomePage() {
  const { user } = await requireAuth();
  if (user.role !== "TRAVELER") redirect("/");

  const trips = await db
    .selectDistinct({
      id: t.trips.id,
      title: t.trips.title,
      destination: t.trips.destination,
      startDate: t.trips.startDate,
      endDate: t.trips.endDate,
    })
    .from(t.travelers)
    .innerJoin(t.tripTravelers, eq(t.tripTravelers.travelerId, t.travelers.id))
    .innerJoin(t.trips, eq(t.trips.id, t.tripTravelers.tripId))
    .where(eq(t.travelers.userId, user.id))
    .orderBy(asc(t.trips.startDate));

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Olá, {user.name.split(" ")[0]}!</h1>
      <p className="mb-4 text-sm text-slate-600">Suas viagens, somente para consulta.</p>
      {trips.length === 0 ? (
        <EmptyState>Você ainda não foi incluído em nenhuma viagem.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link href={`/traveler/trips/${trip.id}`} className="block">
                <Card className="transition-colors hover:border-teal-500">
                  <h2 className="font-medium">{trip.title}</h2>
                  <p className="text-sm text-slate-600">{trip.destination}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
