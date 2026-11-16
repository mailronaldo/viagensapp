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
import { addErrandEntryAction } from "@/app/actions/errand-entries";
import { listRequesters } from "@/services/requesters";
import { listErrandEntries } from "@/services/errands";
import { listTripTravelerOptions } from "@/services/trip-travelers";
import { listClientCurrencyCodes } from "@/services/currencies";
import { ErrandBaseFields, ErrandEntryFields } from "@/components/TripFields";
import { AddPanel, Card, EmptyState, ErrorBanner, Tag, btnDanger, btnGhost, btnPrimary } from "@/components/ui";

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
  const [requesters, travelers, currencies, entries] = await Promise.all([
    listRequesters(trip.ownerId),
    listTripTravelerOptions(trip),
    listClientCurrencyCodes(trip.ownerId),
    listErrandEntries(errand.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-3 text-lg font-medium">Editar encomenda</h2>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateErrandAction.bind(null, trip.id, errand.id)} className="grid gap-3 sm:grid-cols-6">
          <ErrandBaseFields errand={errand} travelers={travelers} requesters={requesters} attachment={attachment} />
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
                  <div className="flex flex-wrap gap-1">
                    <Tag tone={ERRAND_VALUE_STATUS_TONE[entry.valueStatus]}>{ERRAND_VALUE_STATUS_LABEL[entry.valueStatus]}</Tag>
                    <Tag tone={ERRAND_PAYMENT_STATUS_TONE[entry.paymentStatus]}>{ERRAND_PAYMENT_STATUS_LABEL[entry.paymentStatus]}</Tag>
                    <Tag tone={ERRAND_PURCHASE_STATUS_TONE[entry.purchaseStatus]}>{ERRAND_PURCHASE_STATUS_LABEL[entry.purchaseStatus]}</Tag>
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

      <form action={deleteErrandAction.bind(null, trip.id, errand.id)} className="mt-4">
        <button className={btnDanger}>Excluir esta encomenda</button>
      </form>
    </div>
  );
}
