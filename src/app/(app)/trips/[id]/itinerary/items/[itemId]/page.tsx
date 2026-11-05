import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { getTripCities } from "@/services/cities";
import { getActivityPoints, getActivityRegions } from "@/services/activity-points";
import { deleteItemAction, removeReservationAction, updateItemAction } from "@/app/actions/items";
import {
  addActivityPointAction,
  addActivityRegionAction,
  deleteActivityPointAction,
  deleteActivityRegionAction,
} from "@/app/actions/activity-points";
import { ItemMainFields, ReservationFields } from "@/components/TripFields";
import { ActivityPointCard } from "@/components/ActivityPointCard";
import { ActivityRegionCard } from "@/components/ActivityRegionCard";
import { Card, ErrorBanner, btnDanger, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Editar atividade" };

const FORM_ID = "item-edit-form";

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

  const [cities, doc, resDoc, pois, tips, regions] = await Promise.all([
    getTripCities(trip.id),
    item.ticketDocumentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, item.ticketDocumentId)).limit(1)
      : Promise.resolve([]),
    item.reservationDocumentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, item.reservationDocumentId)).limit(1)
      : Promise.resolve([]),
    getActivityPoints(itemId, "POI"),
    getActivityPoints(itemId, "TIP"),
    getActivityRegions(itemId),
  ]);
  const attachment = doc[0]
    ? { name: doc[0].fileName, href: `/api/files/${trip.id}/${item.ticketDocumentId}` }
    : null;
  const reservationAttachment = resDoc[0]
    ? { name: resDoc[0].fileName, href: `/api/files/${trip.id}/${item.reservationDocumentId}` }
    : null;
  const back = `/trips/${trip.id}/itinerary/day/${item.date}`;

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="mb-3 text-lg font-medium">Editar atividade</h2>
      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <form id={FORM_ID} action={updateItemAction.bind(null, trip.id, item.id)} className="grid gap-3 sm:grid-cols-6">
              <ItemMainFields trip={trip} cities={cities} item={item} attachment={attachment} />
            </form>
          </Card>
          <div className="mt-4 flex gap-2">
            <button form={FORM_ID} className={btnPrimary}>
              Salvar alterações
            </button>
            <Link href={back} className={btnGhost}>
              Cancelar
            </Link>
          </div>

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

        <div className="space-y-4">
          <div id="reserva">
            <Card>
              <h3 className="mb-2 font-medium">Reserva</h3>
              <p className="mb-2 text-xs text-slate-500">Preencha se já reservou esta atividade.</p>
              <ReservationFields trip={trip} item={item} reservationAttachment={reservationAttachment} formId={FORM_ID} />
            </Card>
          </div>

          <ActivityPointCard
            title="Pontos de interesse"
            hint="Lugares pra visitar nesta atividade ou nas proximidades."
            items={pois}
            addAction={addActivityPointAction.bind(null, trip.id, itemId, "POI")}
            deleteAction={deleteActivityPointAction.bind(null, trip.id, itemId)}
          />

          <ActivityPointCard
            title="Tips"
            hint="Opções alternativas, caso ainda não tenha reserva ou certeza do que fazer."
            items={tips}
            addAction={addActivityPointAction.bind(null, trip.id, itemId, "TIP")}
            deleteAction={deleteActivityPointAction.bind(null, trip.id, itemId)}
          />

          <ActivityRegionCard
            items={regions}
            addAction={addActivityRegionAction.bind(null, trip.id, itemId)}
            deleteAction={deleteActivityRegionAction.bind(null, trip.id, itemId)}
          />
        </div>
      </div>
    </div>
  );
}
