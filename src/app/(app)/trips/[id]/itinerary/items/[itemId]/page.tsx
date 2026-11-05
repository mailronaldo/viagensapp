import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { getTripCities } from "@/services/cities";
import { deleteItemAction, removeReservationAction, updateItemAction } from "@/app/actions/items";
import { ItemFields } from "@/components/TripFields";
import { Card, ErrorBanner, btnDanger, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Editar atividade" };

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, itemId } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!canWrite) redirect(`/trips/${id}/itinerary`);

  const [item] = await db
    .select()
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, trip.id)))
    .limit(1);
  if (!item) notFound();

  const [cities, doc, resDoc] = await Promise.all([
    getTripCities(trip.id),
    item.ticketDocumentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, item.ticketDocumentId)).limit(1)
      : Promise.resolve([]),
    item.reservationDocumentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, item.reservationDocumentId)).limit(1)
      : Promise.resolve([]),
  ]);
  const attachment = doc[0]
    ? { name: doc[0].fileName, href: `/api/files/${trip.id}/${item.ticketDocumentId}` }
    : null;
  const reservationAttachment = resDoc[0]
    ? { name: resDoc[0].fileName, href: `/api/files/${trip.id}/${item.reservationDocumentId}` }
    : null;
  const back = `/trips/${trip.id}/itinerary/day/${item.date}`;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-3 text-lg font-medium">Editar atividade</h2>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateItemAction.bind(null, trip.id, item.id)} className="grid gap-3 sm:grid-cols-6">
          <ItemFields
            trip={trip}
            cities={cities}
            item={item}
            attachment={attachment}
            reservationAttachment={reservationAttachment}
          />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={back} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
      {(item.reservationProvider ||
        item.reservationCode ||
        item.reservationPrice ||
        item.reservationDetails ||
        item.reservationDocumentId) && (
        <form action={removeReservationAction.bind(null, trip.id, item.id, "edit")} className="mt-4">
          <button className={btnDanger}>Excluir só a reserva desta atividade</button>
          <span className="ml-2 text-xs text-slate-400">(a atividade e o arquivo do voucher ficam)</span>
        </form>
      )}
      <form action={deleteItemAction.bind(null, trip.id, item.id, item.date)} className="mt-4">
        <button className={btnDanger}>Excluir esta atividade</button>
      </form>
    </div>
  );
}
