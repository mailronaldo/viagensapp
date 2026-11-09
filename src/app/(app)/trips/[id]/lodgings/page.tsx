import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { Pencil } from "lucide-react";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";
import { getTripCities } from "@/services/cities";
import { listLodgingTypes, listReservationMethods, toNameMap } from "@/services/catalogs";
import { listVouchersForLodgings } from "@/services/lodging-vouchers";
import { VALUE_STATUS_LABEL, VALUE_STATUS_TONE } from "@/lib/labels";
import { addLodgingAction, deleteLodgingAction } from "@/app/actions/lodgings";
import { LodgingFields } from "@/components/TripFields";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, EmptyState, ErrorBanner, Tag, btnPrimary, tagCls } from "@/components/ui";

const ICON: Record<string, string> = { HOTEL: "🏨", RENTAL: "🏠", HOSTEL: "🛏", RESORT: "🌴", OTHER: "📌" };
const DEFAULT_ICON = "📌";

function nights(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const n = Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  return n > 0 ? n : null;
}

export default async function LodgingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);

  const [rows, cities, types, methods] = await Promise.all([
    db
      .select({ lodging: t.lodgings, fileName: t.documents.fileName, cityName: t.cities.name })
      .from(t.lodgings)
      .leftJoin(t.documents, eq(t.documents.id, t.lodgings.documentId))
      .leftJoin(t.cities, eq(t.cities.id, t.lodgings.cityId))
      .where(eq(t.lodgings.tripId, trip.id))
      .orderBy(sql`${t.lodgings.checkInDate} asc nulls last`, asc(t.lodgings.name)),
    getTripCities(trip.id),
    listLodgingTypes(),
    listReservationMethods(),
  ]);
  const typeName = toNameMap(types);
  const methodName = toNameMap(methods);
  const vouchersByLodging = await listVouchersForLodgings(rows.map((r) => r.lodging.id));

  return (
    <>
      <ErrorBanner message={error} />

      {canWrite && (
        <AddPanel title="Nova hospedagem" defaultOpen={rows.length === 0}>
          <form action={addLodgingAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
            <LodgingFields cities={cities} types={types} methods={methods} />
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Salvar hospedagem</button>
            </div>
          </form>
        </AddPanel>
      )}

      {rows.length === 0 ? (
        <EmptyState>Nenhuma hospedagem cadastrada ainda.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ lodging: l, fileName, cityName }) => {
            const n = nights(l.checkInDate, l.checkOutDate);
            return (
              <li key={l.id} className="relative flex flex-wrap overflow-hidden rounded-lg border border-slate-200 bg-white">
                {canWrite && (
                  <div className="absolute right-3 top-3 flex items-center gap-1">
                    <Link
                      href={`/trips/${trip.id}/lodgings/${l.id}`}
                      aria-label="Editar"
                      title="Editar"
                      className="flex size-7 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50"
                    >
                      <Pencil className="size-4" />
                    </Link>
                    <ConfirmDeleteButton
                      label="Remover"
                      confirmTitle="Remover esta hospedagem?"
                      confirmDescription="Isso remove a hospedagem e o voucher anexado a ela. Não dá pra desfazer."
                      deleteAction={deleteLodgingAction.bind(null, trip.id, l.id)}
                      size="sm"
                    />
                  </div>
                )}
                <div className="flex min-h-28 w-full items-center justify-center bg-brand-50 text-2xl sm:w-32" aria-hidden>
                  {ICON[l.type] ?? DEFAULT_ICON}
                </div>
                <div className="min-w-56 flex-1 p-3 pr-16">
                  <h3 className="font-medium">
                    {canWrite ? (
                      <Link href={`/trips/${trip.id}/lodgings/${l.id}`} className="text-brand-700 hover:underline">
                        {l.name}
                      </Link>
                    ) : (
                      l.name
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {[typeName[l.type], cityName, l.provider ? methodName[l.provider] : null].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1.5">
                    {l.documentId ? (
                      <a
                        href={`/api/files/${trip.id}/${l.documentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`${tagCls("ok")} hover:bg-emerald-200`}
                      >
                        📎 {fileName ?? "Voucher"}
                      </a>
                    ) : (
                      <Tag tone="warn">Falta o voucher</Tag>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600">
                    {l.checkInDate ? formatDate(l.checkInDate) : "Check-in a definir"}
                    {l.checkInTime ? ` · ${l.checkInTime}` : ""}
                    {" → "}
                    {l.checkOutDate ? formatDate(l.checkOutDate) : "check-out a definir"}
                    {l.checkOutTime ? ` · ${l.checkOutTime}` : ""}
                  </p>
                  {l.address && <p className="text-sm text-slate-500">{l.address}</p>}
                  {l.confirmationCode && (
                    <p className="mt-1 text-xs text-slate-500">
                      Confirmação: <span className="font-mono">{l.confirmationCode}</span>
                    </p>
                  )}
                  {l.notes && <p className="mt-1 text-xs text-slate-500">{l.notes}</p>}
                </div>
                <div className="flex w-full flex-col items-end justify-between gap-2 p-3 text-right sm:w-auto sm:min-w-32">
                  <div className="flex items-center gap-1.5">{n && <Tag tone="info">{`${n} noite${n > 1 ? "s" : ""}`}</Tag>}</div>
                  <div className="flex flex-col items-end gap-1">
                    {(vouchersByLodging.get(l.id) ?? []).length === 0 ? (
                      <span className="text-xs text-slate-400">Sem voucher cadastrado</span>
                    ) : (
                      (vouchersByLodging.get(l.id) ?? []).map((v, i) => (
                        <span key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                          {v.price && <span>{formatMoney(v.price, v.currency ?? "BRL")}</span>}
                          <Tag tone={VALUE_STATUS_TONE[v.status as keyof typeof VALUE_STATUS_TONE]}>
                            {VALUE_STATUS_LABEL[v.status as keyof typeof VALUE_STATUS_LABEL]}
                          </Tag>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
