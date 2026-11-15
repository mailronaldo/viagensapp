import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { deleteErrandAction, updateErrandAction } from "@/app/actions/errands";
import { listRequesters } from "@/services/requesters";
import { listTripTravelerOptions } from "@/services/trip-travelers";
import { listClientCurrencyCodes } from "@/services/currencies";
import { ErrandFields } from "@/components/TripFields";
import { Card, ErrorBanner, btnDanger, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Editar encomenda" };

export default async function EditErrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; errandId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, errandId } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!canWrite) redirect(`/trips/${id}/errands`);

  const [errand] = await db
    .select()
    .from(t.errands)
    .where(and(eq(t.errands.id, errandId), eq(t.errands.tripId, trip.id)))
    .limit(1);
  if (!errand) notFound();

  const [doc] = errand.receiptDocumentId
    ? await db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, errand.receiptDocumentId)).limit(1)
    : [];
  const attachment = doc ? { name: doc.fileName, href: `/api/files/${trip.id}/${errand.receiptDocumentId}` } : null;
  const [requesters, travelers, currencies] = await Promise.all([
    listRequesters(trip.ownerId),
    listTripTravelerOptions(trip),
    listClientCurrencyCodes(trip.ownerId),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-3 text-lg font-medium">Editar encomenda</h2>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateErrandAction.bind(null, trip.id, errand.id)} className="grid gap-3 sm:grid-cols-6">
          <ErrandFields trip={trip} errand={errand} travelers={travelers} requesters={requesters} currencies={currencies} attachment={attachment} />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={`/trips/${trip.id}/errands`} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
      <form action={deleteErrandAction.bind(null, trip.id, errand.id)} className="mt-4">
        <button className={btnDanger}>Excluir esta encomenda</button>
      </form>
    </div>
  );
}
