import Link from "next/link";
import { requireTripAccess } from "@/lib/access";
import { formatMoney } from "@/lib/format";
import { listErrands, getErrandSummary } from "@/services/errands";
import { listRequesters } from "@/services/requesters";
import { listStoresForTrip } from "@/services/stores";
import { getTripCities } from "@/services/cities";
import { listTripTravelerOptions } from "@/services/trip-travelers";
import { listClientCurrencyCodes } from "@/services/currencies";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import {
  ERRAND_PAYMENT_STATUS_LABEL,
  ERRAND_PAYMENT_STATUS_TONE,
  ERRAND_PURCHASE_STATUS_LABEL,
  ERRAND_PURCHASE_STATUS_TONE,
  ERRAND_VALUE_STATUS_LABEL,
  ERRAND_VALUE_STATUS_TONE,
} from "@/lib/labels";
import { ErrandBaseFields, ErrandEntryFields } from "@/components/TripFields";
import { addErrandAction, deleteErrandAction } from "@/app/actions/errands";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, Tag, btnDanger, btnPrimary, btnGhost, inputCls } from "@/components/ui";

export default async function ErrandsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; travelerId?: string; requesterId?: string; storeId?: string; newStoreId?: string }>;
}) {
  const { id } = await params;
  const { error, travelerId: travelerFilter, requesterId: requesterFilter, storeId: storeFilter, newStoreId } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  const back = `/trips/${trip.id}/errands`;

  const [owner] = await db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, trip.ownerId)).limit(1);
  const ownerName = owner?.name ?? "Dono da viagem";

  const [allRows, summary, requesters, travelers, currencies, stores, cities] = await Promise.all([
    listErrands(trip.id, ownerName),
    getErrandSummary(trip.id),
    listRequesters(trip.ownerId),
    listTripTravelerOptions(trip),
    listClientCurrencyCodes(trip.ownerId),
    listStoresForTrip(trip),
    getTripCities(trip.id),
  ]);

  const rows = allRows.filter((r) => {
    if (travelerFilter && (r.errand.travelerId ?? "owner") !== travelerFilter) return false;
    if (requesterFilter && r.errand.requesterId !== requesterFilter) return false;
    if (storeFilter && r.errand.storeId !== storeFilter) return false;
    return true;
  });

  return (
    <>
      <ErrorBanner message={error} />

      {summary.byCurrency.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summary.byCurrency.map((c) => (
            <Card key={c.currency}>
              <p className="text-xs text-slate-500">Encomendas em {c.currency}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(c.aPagar + c.pago, c.currency)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatMoney(c.aPagar, c.currency)} a pagar · {formatMoney(c.pago, c.currency)} pago
              </p>
            </Card>
          ))}
        </div>
      )}

      <form className="mb-4 flex flex-wrap gap-3" method="get">
        <select name="travelerId" defaultValue={travelerFilter ?? ""} className={inputCls} style={{ maxWidth: 220 }}>
          <option value="">Todos os viajantes</option>
          {travelers.map((tr) => (
            <option key={tr.id ?? "owner"} value={tr.id ?? "owner"}>
              {tr.name}
            </option>
          ))}
        </select>
        <select name="requesterId" defaultValue={requesterFilter ?? ""} className={inputCls} style={{ maxWidth: 220 }}>
          <option value="">Todos os solicitantes</option>
          {requesters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select name="storeId" defaultValue={storeFilter ?? ""} className={inputCls} style={{ maxWidth: 220 }}>
          <option value="">Todas as lojas</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.type === "ONLINE" ? " (online)" : ""}
            </option>
          ))}
        </select>
        <button className={btnGhost}>Filtrar</button>
        {(travelerFilter || requesterFilter || storeFilter) && (
          <Link href={back} className={btnGhost}>
            Limpar
          </Link>
        )}
      </form>

      {canWrite && (
        <AddPanel title="Nova encomenda" defaultOpen={rows.length === 0}>
          {requesters.length === 0 ? (
            <p className="text-sm text-amber-700">
              Cadastre pelo menos um{" "}
              <Link href="/requesters" className="underline">
                solicitante
              </Link>{" "}
              antes de lançar uma encomenda.
            </p>
          ) : (
            <form action={addErrandAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
              <ErrandBaseFields
                tripId={trip.id}
                back={back}
                travelers={travelers}
                requesters={requesters}
                stores={stores}
                cities={cities}
                defaultStoreId={newStoreId}
              />
              <ErrandEntryFields trip={trip} currencies={currencies} />
              <Field label="Fotos do produto (opcional, uma ou mais imagens)" className="sm:col-span-6">
                <input type="file" name="photos" multiple accept="image/*" className={inputCls} />
              </Field>
              <div className="sm:col-span-6">
                <button className={btnPrimary}>Salvar encomenda</button>
              </div>
            </form>
          )}
        </AddPanel>
      )}

      {rows.length === 0 ? (
        <EmptyState>Nenhuma encomenda {travelerFilter || requesterFilter || storeFilter ? "encontrada com esse filtro" : "cadastrada ainda"}.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Produto</th>
                <th className="px-4 py-2 font-medium">Viajante</th>
                <th className="px-4 py-2 font-medium">Solicitante</th>
                <th className="px-4 py-2 font-medium">Loja</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Valor</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ errand: e, latest, travelerName, requesterName, storeName }) => (
                <tr key={e.id}>
                  <td className="px-4 py-2">
                    {e.product}
                    {e.receiptDocumentId && (
                      <span className="block text-xs text-slate-400">
                        <a href={`/api/files/${trip.id}/${e.receiptDocumentId}`} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                          📎 recibo
                        </a>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{travelerName}</td>
                  <td className="px-4 py-2 text-slate-600">{requesterName}</td>
                  <td className="px-4 py-2 text-slate-600">{storeName ?? "—"}</td>
                  <td className="px-4 py-2">
                    {latest ? (
                      <div className="flex flex-wrap gap-1">
                        <Tag tone={ERRAND_VALUE_STATUS_TONE[latest.valueStatus]}>{ERRAND_VALUE_STATUS_LABEL[latest.valueStatus]}</Tag>
                        <Tag tone={ERRAND_PAYMENT_STATUS_TONE[latest.paymentStatus]}>{ERRAND_PAYMENT_STATUS_LABEL[latest.paymentStatus]}</Tag>
                        <Tag tone={ERRAND_PURCHASE_STATUS_TONE[latest.purchaseStatus]}>{ERRAND_PURCHASE_STATUS_LABEL[latest.purchaseStatus]}</Tag>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                    {latest?.price ? formatMoney(latest.price, latest.currency ?? trip.baseCurrency) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canWrite && (
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/trips/${trip.id}/errands/${e.id}`} className="text-xs text-brand-700 hover:underline">
                          Editar
                        </Link>
                        <form action={deleteErrandAction.bind(null, trip.id, e.id)}>
                          <button className={btnDanger}>Remover</button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
