import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { getTripCities } from "@/services/cities";
import { deleteLodgingAction, updateLodgingAction } from "@/app/actions/lodgings";
import { LodgingFields } from "@/components/TripFields";
import { Card, ErrorBanner, btnDanger, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Editar hospedagem" };

export default async function EditLodgingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lodgingId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, lodgingId } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!canWrite) redirect(`/trips/${id}/lodgings`);

  const [lodging] = await db
    .select()
    .from(t.lodgings)
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, trip.id)))
    .limit(1);
  if (!lodging) notFound();

  const [cities, doc] = await Promise.all([
    getTripCities(trip.id),
    lodging.documentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, lodging.documentId)).limit(1)
      : Promise.resolve([]),
  ]);
  const attachment = doc[0] ? { name: doc[0].fileName, href: `/api/files/${trip.id}/${lodging.documentId}` } : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-3 text-lg font-medium">Editar hospedagem</h2>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateLodgingAction.bind(null, trip.id, lodging.id)} className="grid gap-3 sm:grid-cols-6">
          <LodgingFields trip={trip} cities={cities} lodging={lodging} attachment={attachment} />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={`/trips/${trip.id}/lodgings`} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
      <form action={deleteLodgingAction.bind(null, trip.id, lodging.id)} className="mt-4">
        <button className={btnDanger}>Excluir esta hospedagem</button>
      </form>
    </div>
  );
}
