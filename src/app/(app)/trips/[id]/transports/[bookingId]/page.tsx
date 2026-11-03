import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { deleteBookingAction, updateBookingAction } from "@/app/actions/bookings";
import { BookingFields } from "@/components/TripFields";
import { Card, ErrorBanner, btnDanger, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Editar transporte" };

export default async function EditBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; bookingId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, bookingId } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!canWrite) redirect(`/trips/${id}/transports`);

  const [booking] = await db
    .select()
    .from(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, trip.id)))
    .limit(1);
  if (!booking) notFound();

  const [doc] = booking.documentId
    ? await db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, booking.documentId)).limit(1)
    : [];
  const attachment = doc ? { name: doc.fileName, href: `/api/files/${trip.id}/${booking.documentId}` } : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-3 text-lg font-medium">Editar transporte</h2>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateBookingAction.bind(null, trip.id, booking.id)} className="grid gap-3 sm:grid-cols-6">
          <BookingFields trip={trip} booking={booking} attachment={attachment} />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={`/trips/${trip.id}/transports`} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
      <form action={deleteBookingAction.bind(null, trip.id, booking.id)} className="mt-4">
        <button className={btnDanger}>Excluir este transporte</button>
      </form>
    </div>
  );
}
