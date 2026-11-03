import Link from "next/link";
import { requireTripAccess } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { TripTabs } from "@/components/TripTabs";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { trip, role } = await requireTripAccess(id);

  return (
    <>
      <Link href="/" className="text-xs text-slate-500 hover:underline">
        ← Todas as viagens
      </Link>
      <div className="mb-4 mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{trip.title}</h1>
          <p className="text-sm text-slate-600">
            {trip.destination} · {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
          </p>
        </div>
        {role === "OWNER" && (
          <Link href={`/trips/${trip.id}/edit`} className="shrink-0 text-sm text-teal-700 hover:underline">
            Editar viagem
          </Link>
        )}
      </div>
      <TripTabs tripId={trip.id} />
      {children}
    </>
  );
}
