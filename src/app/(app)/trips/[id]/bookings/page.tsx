import { asc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDateTime, formatMoney } from "@/lib/format";
import { BOOKING_TYPE_LABEL, CURRENCIES } from "@/lib/labels";
import { addBookingAction, deleteBookingAction } from "@/app/actions/bookings";
import {
  AddPanel,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  btnDanger,
  btnPrimary,
  inputCls,
} from "@/components/ui";

const ICON: Record<string, string> = {
  FLIGHT: "✈",
  HOTEL: "🏨",
  CAR_RENTAL: "🚗",
  TRANSFER: "🚐",
  TRAIN: "🚆",
  OTHER: "📌",
};

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);

  const rows = await db
    .select({ booking: t.bookings, fileName: t.documents.fileName })
    .from(t.bookings)
    .leftJoin(t.documents, eq(t.documents.id, t.bookings.documentId))
    .where(eq(t.bookings.tripId, trip.id))
    .orderBy(sql`${t.bookings.startAt} asc nulls last`, asc(t.bookings.title));

  return (
    <>
      <ErrorBanner message={error} />

      {canWrite && (
        <AddPanel title="Nova reserva" defaultOpen={rows.length === 0}>
          <form
            action={addBookingAction.bind(null, trip.id)}
            className="grid gap-3 sm:grid-cols-6"
          >
            <Field label="Tipo" className="sm:col-span-2">
              <select name="type" className={inputCls} defaultValue="FLIGHT">
                {Object.entries(BOOKING_TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Título" className="sm:col-span-4">
              <input name="title" required placeholder="Ex.: Voo GRU → LIS" className={inputCls} />
            </Field>
            <Field label="Companhia / fornecedor" className="sm:col-span-3">
              <input name="provider" className={inputCls} />
            </Field>
            <Field label="Código de confirmação" className="sm:col-span-3">
              <input name="confirmationCode" className={inputCls} />
            </Field>
            <Field label="Início (horário local do local)" className="sm:col-span-3">
              <input name="startAt" type="datetime-local" className={inputCls} />
            </Field>
            <Field label="Término (horário local do local)" className="sm:col-span-3">
              <input name="endAt" type="datetime-local" className={inputCls} />
            </Field>
            <Field label="Origem (voos/trens)" className="sm:col-span-3">
              <input name="origin" className={inputCls} />
            </Field>
            <Field label="Destino (voos/trens)" className="sm:col-span-3">
              <input name="destination" className={inputCls} />
            </Field>
            <Field label="Endereço (hotéis/locais)" className="sm:col-span-6">
              <input name="address" className={inputCls} />
            </Field>
            <Field label="Valor total" className="sm:col-span-2">
              <input name="totalPrice" inputMode="decimal" placeholder="0,00" className={inputCls} />
            </Field>
            <Field label="Moeda" className="sm:col-span-1">
              <select name="currency" defaultValue={trip.baseCurrency} className={inputCls}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Voucher / e-ticket (PDF ou imagem)" className="sm:col-span-3">
              <input name="voucher" type="file" accept="application/pdf,image/*" className={inputCls} />
            </Field>
            <Field label="Detalhes" className="sm:col-span-6">
              <textarea name="details" rows={2} className={inputCls} />
            </Field>
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Salvar reserva</button>
            </div>
          </form>
        </AddPanel>
      )}

      {rows.length === 0 ? (
        <EmptyState>Nenhuma reserva cadastrada ainda.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ booking: b, fileName }) => (
            <li key={b.id}>
              <Card className="flex gap-4">
                <span className="text-2xl" aria-hidden>
                  {ICON[b.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h3 className="font-medium">{b.title}</h3>
                    <span className="text-xs text-slate-500">{BOOKING_TYPE_LABEL[b.type]}</span>
                    {b.provider && <span className="text-xs text-slate-400">· {b.provider}</span>}
                  </div>
                  <p className="text-sm text-slate-600">
                    {b.startAt ? formatDateTime(b.startAt) : "Sem data"}
                    {b.endAt ? ` → ${formatDateTime(b.endAt)}` : ""}
                  </p>
                  {(b.origin || b.destination) && (
                    <p className="text-sm text-slate-600">
                      {b.origin} → {b.destination}
                    </p>
                  )}
                  {b.address && <p className="text-sm text-slate-500">{b.address}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    {b.confirmationCode && (
                      <span className="mr-3">
                        Confirmação: <span className="font-mono">{b.confirmationCode}</span>
                      </span>
                    )}
                    {b.totalPrice && b.currency && (
                      <span>{formatMoney(b.totalPrice, b.currency)}</span>
                    )}
                  </p>
                  {b.details && <p className="mt-1 text-xs text-slate-500">{b.details}</p>}
                  {b.documentId && (
                    <a
                      href={`/api/files/${trip.id}/${b.documentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-teal-700 hover:underline"
                    >
                      📎 {fileName ?? "Voucher"}
                    </a>
                  )}
                </div>
                {canWrite && (
                  <form action={deleteBookingAction.bind(null, trip.id, b.id)}>
                    <button className={btnDanger}>Remover</button>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
