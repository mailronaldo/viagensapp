import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";
import {
  ERRAND_PAYMENT_STATUS_LABEL,
  ERRAND_PAYMENT_STATUS_TONE,
  ERRAND_PURCHASE_STATUS_LABEL,
  ERRAND_PURCHASE_STATUS_TONE,
  ERRAND_VALUE_STATUS_LABEL,
  ERRAND_VALUE_STATUS_TONE,
} from "@/lib/labels";
import { deleteErrandAction, updateErrandAction } from "@/app/actions/errands";
import { addErrandEntryAction, deleteErrandEntryAction } from "@/app/actions/errand-entries";
import { addErrandPhotosAction, deleteErrandPhotoAction } from "@/app/actions/errand-photos";
import { listRequesters } from "@/services/requesters";
import { listErrandEntries, listErrandPhotos } from "@/services/errands";
import { listStoresForTrip } from "@/services/stores";
import { getTripCities } from "@/services/cities";
import { listTripTravelerOptions } from "@/services/trip-travelers";
import { listClientCurrencyCodes } from "@/services/currencies";
import { ErrandBaseFields, ErrandEntryFields } from "@/components/TripFields";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, Tag, btnDanger, btnGhost, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Editar encomenda" };

export default async function EditErrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; errandId: string }>;
  searchParams: Promise<{ error?: string; newStoreId?: string }>;
}) {
  const { id, errandId } = await params;
  const { error, newStoreId } = await searchParams;
  const { trip, canWrite, role } = await requireTripAccess(id);
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
  const [requesters, travelers, currencies, entries, stores, cities, photos] = await Promise.all([
    listRequesters(trip.ownerId),
    listTripTravelerOptions(trip),
    listClientCurrencyCodes(trip.ownerId),
    listErrandEntries(errand.id),
    listStoresForTrip(trip),
    getTripCities(trip.id),
    listErrandPhotos(errand.id),
  ]);
  const back = `/trips/${trip.id}/errands/${errand.id}`;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-3 text-lg font-medium">Editar encomenda</h2>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateErrandAction.bind(null, trip.id, errand.id)} className="grid gap-3 sm:grid-cols-6">
          <ErrandBaseFields
            tripId={trip.id}
            back={back}
            errand={errand}
            travelers={travelers}
            requesters={requesters}
            stores={stores}
            cities={cities}
            defaultStoreId={newStoreId}
            attachment={attachment}
          />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={`/trips/${trip.id}/errands`} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        <AddPanel title={`Histórico de valor/status${entries.length > 0 ? ` (${entries.length})` : ""}`} defaultOpen>
          {entries.length === 0 ? (
            <EmptyState>Nenhum lançamento ainda.</EmptyState>
          ) : (
            <ul className="mb-4 space-y-2">
              {entries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">{formatDate(entry.createdAt.toISOString().slice(0, 10))}</p>
                    <p className="font-medium tabular-nums">{entry.price ? formatMoney(entry.price, entry.currency ?? trip.baseCurrency) : "—"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Tag tone={ERRAND_VALUE_STATUS_TONE[entry.valueStatus]}>{ERRAND_VALUE_STATUS_LABEL[entry.valueStatus]}</Tag>
                    <Tag tone={ERRAND_PAYMENT_STATUS_TONE[entry.paymentStatus]}>{ERRAND_PAYMENT_STATUS_LABEL[entry.paymentStatus]}</Tag>
                    <Tag tone={ERRAND_PURCHASE_STATUS_TONE[entry.purchaseStatus]}>{ERRAND_PURCHASE_STATUS_LABEL[entry.purchaseStatus]}</Tag>
                    {role === "OWNER" && (
                      <ConfirmDeleteButton
                        label="Excluir lançamento"
                        confirmTitle="Excluir este lançamento?"
                        confirmDescription="Isso remove esse lançamento do histórico (ex.: erro de digitação). Não dá pra desfazer."
                        deleteAction={deleteErrandEntryAction.bind(null, trip.id, errand.id, entry.id)}
                        size="sm"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mb-2 text-sm font-medium">Lançar nova atualização</p>
          <form action={addErrandEntryAction.bind(null, trip.id, errand.id)} className="grid gap-3 sm:grid-cols-6">
            <ErrandEntryFields trip={trip} currencies={currencies} />
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Lançar atualização</button>
            </div>
          </form>
        </AddPanel>
      </div>

      <div className="mt-6">
        <AddPanel title={`Fotos do produto${photos.length > 0 ? ` (${photos.length})` : ""}`} defaultOpen={photos.length === 0}>
          {photos.length > 0 && (
            <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200">
                  <a href={`/api/files/${trip.id}/${photo.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto enviada pelo cliente, servida por rota autenticada (não dá pra usar next/image aqui) */}
                    <img src={`/api/files/${trip.id}/${photo.id}`} alt={photo.title} className="size-full object-cover" />
                  </a>
                  <div className="absolute right-1 top-1">
                    <ConfirmDeleteButton
                      label="Excluir foto"
                      confirmTitle="Excluir esta foto?"
                      confirmDescription="Isso remove a foto do produto. Não dá pra desfazer."
                      deleteAction={deleteErrandPhotoAction.bind(null, trip.id, errand.id, photo.id)}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <form action={addErrandPhotosAction.bind(null, trip.id, errand.id)} className="grid gap-3">
            <Field label="Adicionar fotos (uma ou mais imagens)">
              <input type="file" name="photos" multiple accept="image/*" className={inputCls} />
            </Field>
            <div>
              <button className={btnPrimary}>Adicionar fotos</button>
            </div>
          </form>
        </AddPanel>
      </div>

      <form action={deleteErrandAction.bind(null, trip.id, errand.id)} className="mt-4">
        <button className={btnDanger}>Excluir esta encomenda</button>
      </form>
    </div>
  );
}
