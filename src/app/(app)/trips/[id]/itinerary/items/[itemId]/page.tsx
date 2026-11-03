import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { deleteItemAction, updateItemAction } from "@/app/actions/items";
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

  const [cities, doc] = await Promise.all([
    db.select({ id: t.cities.id, name: t.cities.name }).from(t.cities).where(eq(t.cities.tripId, trip.id)).orderBy(asc(t.cities.position)),
    item.ticketDocumentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, item.ticketDocumentId)).limit(1)
      : Promise.resolve([]),
  ]);
  const attachment = doc[0]
    ? { name: doc[0].fileName, href: `/api/files/${trip.id}/${item.ticketDocumentId}` }
    : null;
  const back = `/trips/${trip.id}/itinerary?day=${item.date}`;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-3 text-lg font-medium">Editar atividade</h2>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateItemAction.bind(null, trip.id, item.id)} className="grid gap-3 sm:grid-cols-6">
          <ItemFields trip={trip} cities={cities} item={item} attachment={attachment} />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={back} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
      <form action={deleteItemAction.bind(null, trip.id, item.id, item.date)} className="mt-4">
        <button className={btnDanger}>Excluir esta atividade</button>
      </form>
    </div>
  );
}
