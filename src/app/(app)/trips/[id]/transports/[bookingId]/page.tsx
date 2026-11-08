import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { getTripCities } from "@/services/cities";
import { listBookingTypes } from "@/services/catalogs";
import { deleteBookingAction, updateBookingAction } from "@/app/actions/bookings";
import { BookingFields } from "@/components/TripFields";
import { SavedModal } from "@/components/SavedModal";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Card, ErrorBanner, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Editar transporte" };

export default async function EditBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; bookingId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; day?: string }>;
}) {
  const { id, bookingId } = await params;
  const { error, saved, day } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!canWrite) redirect(`/trips/${id}/transports`);
  const cancelHref = day ? `/trips/${id}/itinerary/day/${day}` : `/trips/${id}/transports`;

  const [booking] = await db
    .select()
    .from(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, trip.id)))
    .limit(1);
  if (!booking) notFound();

  const [[doc], cities, types] = await Promise.all([
    booking.documentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, booking.documentId)).limit(1)
      : Promise.resolve([]),
    getTripCities(trip.id),
    listBookingTypes(),
  ]);
  const attachment = doc ? { name: doc.fileName, href: `/api/files/${trip.id}/${booking.documentId}` } : null;

  return (
    <div className="mx-auto max-w-3xl">
      {saved === "1" && (
        <SavedModal
          key={saved}
          show
          title="Transporte salvo ✓"
          body="As alterações do transporte foram salvas."
          cleanUrl={`/trips/${trip.id}/transports/${booking.id}${day ? `?day=${day}` : ""}`}
        />
      )}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Editar transporte</h2>
          <div className="flex items-center gap-1">
            <Link
              href={cancelHref}
              aria-label="Voltar"
              title="Voltar"
              className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <ConfirmDeleteButton
              label="Excluir transporte"
              confirmTitle="Excluir este transporte?"
              confirmDescription="Isso remove o transporte e o voucher anexado a ele. Não dá pra desfazer."
              deleteAction={deleteBookingAction.bind(null, trip.id, booking.id)}
            />
          </div>
        </div>
        <ErrorBanner message={error} />
        <form action={updateBookingAction.bind(null, trip.id, booking.id)} className="grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="day" value={day ?? ""} />
          <BookingFields trip={trip} cities={cities} types={types} booking={booking} attachment={attachment} />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={cancelHref} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
