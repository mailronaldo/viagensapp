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
  const { trip } = await requireTripAccess(id);

  return (
    <>
      <Link href="/" className="text-xs text-slate-500 hover:underline">
        ← Todas as viagens
      </Link>
      <div className="mb-4 mt-2">
        <h1 className="text-2xl font-semibold">{trip.title}</h1>
        <p className="text-sm text-slate-600">
          {trip.destination} · {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
        </p>
      </div>
      <TripTabs tripId={trip.id} />
      {children}
    </>
  );
}
