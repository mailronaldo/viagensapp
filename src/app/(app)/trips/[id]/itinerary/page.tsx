import { redirect } from "next/navigation";
import { requireTripAccess } from "@/lib/access";
import { todayIn } from "@/lib/format";

// "Roteiro" não tem mais uma lista resumida própria (isso agora é o dashboard
// da viagem, em /trips/[id]) — ao clicar, já abre o dia detalhado.
export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip } = await requireTripAccess(id);

  const today = todayIn(trip.timezone);
  const day = today >= trip.startDate && today <= trip.endDate ? today : trip.startDate;
  redirect(`/trips/${trip.id}/itinerary/day/${day}`);
}
