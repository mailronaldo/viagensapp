import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";
import { LODGING_TYPE_LABEL } from "@/lib/labels";
import { addLodgingAction, deleteLodgingAction } from "@/app/actions/lodgings";
import { LodgingFields } from "@/components/TripFields";
import { AddPanel, Card, EmptyState, ErrorBanner, btnDanger, btnPrimary } from "@/components/ui";

const ICON: Record<string, string> = { HOTEL: "🏨", RENTAL: "🏠", HOSTEL: "🛏", RESORT: "🌴", OTHER: "📌" };

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

  const [rows, cities] = await Promise.all([
    db
      .select({ lodging: t.lodgings, fileName: t.documents.fileName, cityName: t.cities.name })
      .from(t.lodgings)
      .leftJoin(t.documents, eq(t.documents.id, t.lodgings.documentId))
      .leftJoin(t.cities, eq(t.cities.id, t.lodgings.cityId))
      .where(eq(t.lodgings.tripId, trip.id))
      .orderBy(sql`${t.lodgings.checkInDate} asc nulls last`, asc(t.lodgings.name)),
    db.select({ id: t.cities.id, name: t.cities.name }).from(t.cities).where(eq(t.cities.tripId, trip.id)).orderBy(asc(t.cities.position)),
  ]);

  return (
    <>
      <ErrorBanner message={error} />

      {canWrite && (
        <AddPanel title="Nova hospedagem" defaultOpen={rows.length === 0}>
          <form action={addLodgingAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
            <LodgingFields trip={trip} cities={cities} />
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
              <li key={l.id}>
                <Card className="flex gap-4">
                  <span className="text-2xl" aria-hidden>
                    {ICON[l.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <h3 className="font-medium">{l.name}</h3>
                      <span className="text-xs text-slate-500">{LODGING_TYPE_LABEL[l.type]}</span>
                      {cityName && <span className="text-xs text-slate-400">· {cityName}</span>}
                      {l.provider && <span className="text-xs text-slate-400">· {l.provider}</span>}
                    </div>
                    <p className="text-sm text-slate-600">
                      {l.checkInDate ? formatDate(l.checkInDate) : "Check-in a definir"}
                      {l.checkInTime ? ` · ${l.checkInTime}` : ""}
                      {" → "}
                      {l.checkOutDate ? formatDate(l.checkOutDate) : "check-out a definir"}
                      {l.checkOutTime ? ` · ${l.checkOutTime}` : ""}
                      {n ? ` (${n} noite${n > 1 ? "s" : ""})` : ""}
                    </p>
                    {l.address && <p className="text-sm text-slate-500">{l.address}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      {l.confirmationCode && (
                        <span className="mr-3">
                          Confirmação: <span className="font-mono">{l.confirmationCode}</span>
                        </span>
                      )}
                      {l.totalPrice && l.currency && <span>{formatMoney(l.totalPrice, l.currency)}</span>}
                    </p>
                    {l.notes && <p className="mt-1 text-xs text-slate-500">{l.notes}</p>}
                    {l.documentId && (
                      <a
                        href={`/api/files/${trip.id}/${l.documentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-teal-700 hover:underline"
                      >
                        📎 {fileName ?? "Voucher"}
                      </a>
                    )}
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0 items-start gap-3">
                      <Link href={`/trips/${trip.id}/lodgings/${l.id}`} className="text-xs text-teal-700 hover:underline">
                        Editar
                      </Link>
                      <form action={deleteLodgingAction.bind(null, trip.id, l.id)}>
                        <button className={btnDanger}>Remover</button>
                      </form>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
