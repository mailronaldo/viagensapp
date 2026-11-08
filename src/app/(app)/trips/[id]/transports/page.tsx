import { asc, eq, inArray, sql } from "drizzle-orm";
import { Pencil } from "lucide-react";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getTripCities } from "@/services/cities";
import { LEGACY_BOOKING_TYPE_IDS, listBookingTypes, toNameMap } from "@/services/catalogs";
import Link from "next/link";
import { BookingFields } from "@/components/TripFields";
import { addBookingAction, deleteBookingAction } from "@/app/actions/bookings";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, btnPrimary } from "@/components/ui";

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

  const [cities, bookingTypes, rows] = await Promise.all([
    getTripCities(trip.id),
    listBookingTypes(),
    db
      .select({
        booking: t.bookings,
        fileName: t.documents.fileName,
        originCityName: t.cities.name,
      })
      .from(t.bookings)
      .leftJoin(t.documents, eq(t.documents.id, t.bookings.documentId))
      .leftJoin(t.cities, eq(t.cities.id, t.bookings.originCityId))
      .where(eq(t.bookings.tripId, trip.id))
      .orderBy(sql`${t.bookings.originAt} asc nulls last`, asc(t.bookings.title)),
  ]);
  // Segunda cidade (destino) resolvida num mapa aparte, já que um left join
  // só dá pra encadear uma vez sem repetir a tabela.
  const destCityIds = rows.map((r) => r.booking.destinationCityId).filter((v): v is string => !!v);
  const destCities = destCityIds.length ? await db.select().from(t.cities).where(inArray(t.cities.id, destCityIds)) : [];
  const destCityName = toNameMap(destCities);
  const typeName = toNameMap(bookingTypes);
  const creatableTypes = bookingTypes.filter((ty) => !LEGACY_BOOKING_TYPE_IDS.includes(ty.id));

  return (
    <>
      <ErrorBanner message={error} />

      {canWrite && (
        <AddPanel title="Novo transporte" defaultOpen={rows.length === 0}>
          <form
            action={addBookingAction.bind(null, trip.id)}
            className="grid gap-3 sm:grid-cols-6"
          >
            <BookingFields trip={trip} cities={cities} types={creatableTypes} />
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Salvar transporte</button>
            </div>
          </form>
        </AddPanel>
      )}

      {rows.length === 0 ? (
        <EmptyState>Nenhum transporte cadastrado ainda.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ booking: b, fileName, originCityName }) => (
            <li key={b.id}>
              <Card className="relative flex gap-4">
                {canWrite && (
                  <div className="absolute right-3 top-3 flex items-center gap-1">
                    <Link
                      href={`/trips/${trip.id}/transports/${b.id}`}
                      aria-label="Editar"
                      title="Editar"
                      className="flex size-7 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50"
                    >
                      <Pencil className="size-4" />
                    </Link>
                    <ConfirmDeleteButton
                      label="Remover"
                      confirmTitle="Remover este transporte?"
                      confirmDescription="Isso remove o transporte e o voucher anexado a ele. Não dá pra desfazer."
                      deleteAction={deleteBookingAction.bind(null, trip.id, b.id)}
                      size="sm"
                    />
                  </div>
                )}
                <span className="text-2xl" aria-hidden>
                  {ICON[b.type] ?? "📌"}
                </span>
                <div className="min-w-0 flex-1 pr-16">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h3 className="font-medium">{b.title}</h3>
                    <span className="text-xs text-slate-500">{typeName[b.type]}</span>
                    {b.provider && <span className="text-xs text-slate-400">· {b.provider}</span>}
                  </div>
                  {(b.originLocation || originCityName || b.destinationLocation || destCityName[b.destinationCityId ?? ""]) && (
                    <p className="text-sm text-slate-600">
                      {[b.originLocation, originCityName].filter(Boolean).join(" · ")}
                      {b.originAt ? ` (${formatDateTime(b.originAt)})` : ""}
                      {" → "}
                      {[b.destinationLocation, destCityName[b.destinationCityId ?? ""]].filter(Boolean).join(" · ")}
                      {b.destinationAt ? ` (${formatDateTime(b.destinationAt)})` : ""}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {b.orderNumber && (
                      <span className="mr-3">
                        Pedido: <span className="font-mono">{b.orderNumber}</span>
                      </span>
                    )}
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
                      className="mt-1 inline-block text-xs text-brand-700 hover:underline"
                    >
                      📎 {fileName ?? "Voucher"}
                    </a>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
