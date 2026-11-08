import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { getTripCities } from "@/services/cities";
import { listLodgingTypes, listReservationMethods } from "@/services/catalogs";
import { listClientCurrencyCodes } from "@/services/currencies";
import { deleteLodgingAction, updateLodgingAction } from "@/app/actions/lodgings";
import { LodgingFields } from "@/components/TripFields";
import { SavedModal } from "@/components/SavedModal";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Card, ErrorBanner, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Editar hospedagem" };

export default async function EditLodgingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lodgingId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; day?: string }>;
}) {
  const { id, lodgingId } = await params;
  const { error, saved, day } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!canWrite) redirect(`/trips/${id}/lodgings`);
  const cancelHref = day ? `/trips/${id}/itinerary/day/${day}` : `/trips/${id}/lodgings`;

  const [lodging] = await db
    .select()
    .from(t.lodgings)
    .where(and(eq(t.lodgings.id, lodgingId), eq(t.lodgings.tripId, trip.id)))
    .limit(1);
  if (!lodging) notFound();

  const [cities, types, methods, doc, currencies] = await Promise.all([
    getTripCities(trip.id),
    listLodgingTypes(),
    listReservationMethods(),
    lodging.documentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, lodging.documentId)).limit(1)
      : Promise.resolve([]),
    listClientCurrencyCodes(trip.ownerId),
  ]);
  const attachment = doc[0] ? { name: doc[0].fileName, href: `/api/files/${trip.id}/${lodging.documentId}` } : null;

  return (
    <div className="mx-auto max-w-3xl">
      {saved === "1" && (
        <SavedModal
          key={saved}
          show
          title="Hospedagem salva ✓"
          body="As alterações da hospedagem foram salvas."
          cleanUrl={`/trips/${trip.id}/lodgings/${lodging.id}${day ? `?day=${day}` : ""}`}
        />
      )}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Editar hospedagem</h2>
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
              label="Excluir hospedagem"
              confirmTitle="Excluir esta hospedagem?"
              confirmDescription="Isso remove a hospedagem e o voucher anexado a ela. Não dá pra desfazer."
              deleteAction={deleteLodgingAction.bind(null, trip.id, lodging.id)}
            />
          </div>
        </div>
        <ErrorBanner message={error} />
        <form action={updateLodgingAction.bind(null, trip.id, lodging.id)} className="grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="day" value={day ?? ""} />
          <LodgingFields
            trip={trip}
            cities={cities}
            types={types}
            methods={methods}
            lodging={lodging}
            attachment={attachment}
            currencies={currencies}
          />
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
