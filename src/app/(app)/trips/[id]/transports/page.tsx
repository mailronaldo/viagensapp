import { asc, eq } from "drizzle-orm";
import { Pencil } from "lucide-react";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getTripCities } from "@/services/cities";
import { LEGACY_BOOKING_TYPE_IDS, listBookingTypes, toNameMap } from "@/services/catalogs";
import { listVouchersForBookings } from "@/services/transport-vouchers";
import { listLegsForBookings } from "@/services/booking-legs";
import { VALUE_STATUS_LABEL, VALUE_STATUS_TONE, TRIP_TYPE_LABEL } from "@/lib/labels";
import Link from "next/link";
import { BookingFields } from "@/components/TripFields";
import { addBookingAction, deleteBookingAction } from "@/app/actions/bookings";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Tag, btnPrimary } from "@/components/ui";

const ICON: Record<string, string> = {
  FLIGHT: "✈",
  HOTEL: "🏨",
  CAR_RENTAL: "🚗",
  TRANSFER: "🚐",
  TRAIN: "🚆",
  OTHER: "📌",
};

const LEG_LABEL: Record<string, (i: number, total: number) => string | null> = {
  ONE_WAY: () => null,
  ROUND_TRIP: (i) => (i === 0 ? "Ida" : "Volta"),
  MULTI_LEG: (i, total) => (total > 1 ? `Trecho ${i + 1}` : null),
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

  const [cities, bookingTypes, rows, [owner]] = await Promise.all([
    getTripCities(trip.id),
    listBookingTypes(),
    db
      .select({ booking: t.bookings, fileName: t.documents.fileName })
      .from(t.bookings)
      .leftJoin(t.documents, eq(t.documents.id, t.bookings.documentId))
      .where(eq(t.bookings.tripId, trip.id))
      .orderBy(asc(t.bookings.title)),
    db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, trip.ownerId)).limit(1),
  ]);
  const typeName = toNameMap(bookingTypes);
  const creatableTypes = bookingTypes.filter((ty) => !LEGACY_BOOKING_TYPE_IDS.includes(ty.id));
  const vouchersByBooking = await listVouchersForBookings(rows.map((r) => r.booking.id), owner?.name ?? "Dono");
  const legsByBooking = await listLegsForBookings(rows.map((r) => r.booking.id));
  const cityNameById = toNameMap(cities);

  const sortedRows = [...rows].sort((a, b) => {
    const aAt = legsByBooking.get(a.booking.id)?.[0]?.originAt ?? "9999-99-99";
    const bAt = legsByBooking.get(b.booking.id)?.[0]?.originAt ?? "9999-99-99";
    return aAt < bAt ? -1 : aAt > bAt ? 1 : a.booking.title.localeCompare(b.booking.title);
  });

  return (
    <>
      <ErrorBanner message={error} />

      {canWrite && (
        <AddPanel title="Novo transporte" defaultOpen={rows.length === 0}>
          <form
            action={addBookingAction.bind(null, trip.id)}
            className="grid gap-3 sm:grid-cols-6"
          >
            <BookingFields cities={cities} types={creatableTypes} />
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
          {sortedRows.map(({ booking: b, fileName }) => {
            const legs = legsByBooking.get(b.id) ?? [];
            const legLabeler = LEG_LABEL[b.tripType] ?? (() => null);
            return (
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
                        confirmDescription="Isso remove o transporte, os trechos e o voucher anexado a ele. Não dá pra desfazer."
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
                      {b.tripType !== "ONE_WAY" && <Tag tone="neutral">{TRIP_TYPE_LABEL[b.tripType]}</Tag>}
                    </div>
                    {legs.length > 0 ? (
                      <div className="space-y-0.5">
                        {legs.map((leg, i) => {
                          const origin = [leg.originLocation, leg.originCityId ? cityNameById[leg.originCityId] : null].filter(Boolean).join(" · ");
                          const destination = [leg.destinationLocation, leg.destinationCityId ? cityNameById[leg.destinationCityId] : null]
                            .filter(Boolean)
                            .join(" · ");
                          const label = legLabeler(i, legs.length);
                          if (!origin && !destination) return null;
                          return (
                            <p key={leg.id} className="text-sm text-slate-600">
                              {label && <span className="text-xs text-slate-400">{label}: </span>}
                              {origin}
                              {leg.originAt ? ` (${formatDateTime(leg.originAt)})` : ""}
                              {" → "}
                              {destination}
                              {leg.destinationAt ? ` (${formatDateTime(leg.destinationAt)})` : ""}
                            </p>
                          );
                        })}
                      </div>
                    ) : (
                      b.tripType === "MULTI_LEG" && <p className="text-sm text-amber-700">Nenhum trecho cadastrado ainda</p>
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
                    </p>
                    {(() => {
                      const vouchers = vouchersByBooking.get(b.id) ?? [];
                      return vouchers.length > 0 ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {vouchers.map((v, i) => (
                            <span key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                              {v.scopeLabel}
                              {v.price && <span>· {formatMoney(v.price, v.currency ?? "BRL")}</span>}
                              <Tag tone={VALUE_STATUS_TONE[v.status as keyof typeof VALUE_STATUS_TONE]}>
                                {VALUE_STATUS_LABEL[v.status as keyof typeof VALUE_STATUS_LABEL]}
                              </Tag>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">Sem voucher cadastrado</p>
                      );
                    })()}
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
            );
          })}
        </ul>
      )}
    </>
  );
}
