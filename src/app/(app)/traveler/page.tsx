import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAuth } from "@/lib/auth";
import { TripCard } from "@/components/TripCard";
import { EmptyState, Hero } from "@/components/ui";

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
      permission: t.tripTravelers.permission,
    })
    .from(t.travelers)
    .innerJoin(t.tripTravelers, eq(t.tripTravelers.travelerId, t.travelers.id))
    .innerJoin(t.trips, eq(t.trips.id, t.tripTravelers.tripId))
    .where(eq(t.travelers.userId, user.id))
    .orderBy(asc(t.trips.startDate));

  return (
    <>
      <Hero>
        <h1 className="text-2xl font-semibold">Olá, {user.name.split(" ")[0]}!</h1>
        <p className="text-sm text-brand-100">Suas viagens.</p>
      </Hero>
      {trips.length === 0 ? (
        <EmptyState>Você ainda não foi incluído em nenhuma viagem.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <TripCard
                href={trip.permission === "FULL" ? `/trips/${trip.id}` : `/traveler/trips/${trip.id}`}
                title={trip.title}
                destination={trip.destination}
                startDate={trip.startDate}
                endDate={trip.endDate}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
