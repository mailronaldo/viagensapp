import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { ArrowLeft, Pencil } from "lucide-react";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getTripCities, listNeighborhoodsForCities } from "@/services/cities";
import { listBookingTypes } from "@/services/catalogs";
import { listClientCurrencyCodes } from "@/services/currencies";
import { listTripTravelerOptions } from "@/services/trip-travelers";
import { listBookingVouchers } from "@/services/transport-vouchers";
import { listBookingLegs } from "@/services/booking-legs";
import { deleteBookingAction, updateBookingAction } from "@/app/actions/bookings";
import { addVoucherAction, deleteVoucherAction, updateVoucherAction } from "@/app/actions/transport-vouchers";
import { addLegAction, deleteLegAction, updateLegAction } from "@/app/actions/booking-legs";
import { BookingFields, LegFields, TransportVoucherFields } from "@/components/TripFields";
import { SavedModal } from "@/components/SavedModal";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Tag, btnGhost, btnPrimary } from "@/components/ui";
import { VALUE_STATUS_LABEL, VALUE_STATUS_TONE } from "@/lib/labels";

export const metadata = { title: "Editar transporte" };

export default async function EditBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; bookingId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; day?: string }>;
}) {
  const { id, bookingId } = await params;
  const { error, saved, day } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!canWrite) redirect(`/trips/${id}/transports`);
  const cancelHref = day ? `/trips/${id}/itinerary/day/${day}` : `/trips/${id}/transports`;

  const [booking] = await db
    .select()
    .from(t.bookings)
    .where(and(eq(t.bookings.id, bookingId), eq(t.bookings.tripId, trip.id)))
    .limit(1);
  if (!booking) notFound();

  const [[doc], cities, types, currencies, travelerOptions, [owner]] = await Promise.all([
    booking.documentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, booking.documentId)).limit(1)
      : Promise.resolve([]),
    getTripCities(trip.id),
    listBookingTypes(),
    listClientCurrencyCodes(trip.ownerId),
    listTripTravelerOptions(trip),
    db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, trip.ownerId)).limit(1),
  ]);
  const attachment = doc ? { name: doc.fileName, href: `/api/files/${trip.id}/${booking.documentId}` } : null;
  const neighborhoods = await listNeighborhoodsForCities(cities.map((c) => c.id));
  const legs = await listBookingLegs(bookingId);
  const vouchers = await listBookingVouchers(bookingId, owner?.name ?? "Dono");
  const voucherDocIds = vouchers.map((v) => v.voucherDocumentId).filter((docId): docId is string => !!docId);
  const voucherDocs = voucherDocIds.length
    ? await db.select({ id: t.documents.id, fileName: t.documents.fileName }).from(t.documents).where(inArray(t.documents.id, voucherDocIds))
    : [];
  const voucherDocById = new Map(voucherDocs.map((d) => [d.id, d.fileName]));
  const usedTravelerIds = new Set(vouchers.filter((v) => !v.isGroup).map((v) => v.travelerId));
  const availableTravelerOptions = travelerOptions.filter((tr) => !usedTravelerIds.has(tr.id));
  const groupVoucherExists = vouchers.some((v) => v.isGroup);

  return (
    <div className="mx-auto max-w-3xl">
      {saved === "1" && (
        <SavedModal
          key={saved}
          show
          title="Transporte salvo ✓"
          body="As alterações do transporte foram salvas."
          cleanUrl={`/trips/${trip.id}/transports/${booking.id}${day ? `?day=${day}` : ""}`}
        />
      )}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Editar transporte</h2>
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
              label="Excluir transporte"
              confirmTitle="Excluir este transporte?"
              confirmDescription="Isso remove o transporte e o voucher anexado a ele. Não dá pra desfazer."
              deleteAction={deleteBookingAction.bind(null, trip.id, booking.id)}
            />
          </div>
        </div>
        <ErrorBanner message={error} />
        <form action={updateBookingAction.bind(null, trip.id, booking.id)} className="grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="day" value={day ?? ""} />
          <BookingFields cities={cities} types={types} neighborhoods={neighborhoods} booking={booking} legs={legs} attachment={attachment} />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={cancelHref} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>

      {booking.tripType === "MULTI_LEG" && (
        <div className="mt-6">
          <AddPanel title={`Trechos${legs.length > 0 ? ` (${legs.length})` : ""}`} defaultOpen={legs.length === 0}>
            {legs.length > 0 && (
              <ul className="mb-4 space-y-2">
                {legs.map((leg, i) => (
                  <li key={leg.id} className="rounded-lg border border-slate-200">
                    <details className="group">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">Trecho {i + 1}</p>
                          <p className="text-xs text-slate-500">
                            {[leg.originLocation, leg.originAt ? formatDateTime(leg.originAt) : null].filter(Boolean).join(" · ") || "Origem não definida"}
                            {" → "}
                            {[leg.destinationLocation, leg.destinationAt ? formatDateTime(leg.destinationAt) : null].filter(Boolean).join(" · ") ||
                              "Destino não definido"}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1">
                          <Pencil className="size-4 text-slate-400" aria-hidden />
                          <ConfirmDeleteButton
                            label="Excluir"
                            confirmTitle="Excluir este trecho?"
                            confirmDescription="Isso remove este trecho do transporte."
                            deleteAction={deleteLegAction.bind(null, trip.id, booking.id, leg.id)}
                            size="sm"
                          />
                        </span>
                      </summary>
                      <div className="border-t border-slate-100 p-3">
                        <form action={updateLegAction.bind(null, trip.id, booking.id, leg.id)} className="grid gap-3 sm:grid-cols-6">
                          <LegFields cities={cities} neighborhoods={neighborhoods} leg={leg} />
                          <div className="sm:col-span-6">
                            <button className={btnPrimary}>Salvar trecho</button>
                          </div>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <form action={addLegAction.bind(null, trip.id, booking.id)} className="grid gap-3 sm:grid-cols-6">
              <LegFields cities={cities} neighborhoods={neighborhoods} />
              <div className="sm:col-span-6">
                <button className={btnPrimary}>Adicionar trecho</button>
              </div>
            </form>
          </AddPanel>
        </div>
      )}

      <div className="mt-6">
        <AddPanel title={`Voucher${vouchers.length > 0 ? ` (${vouchers.length})` : ""}`} defaultOpen={vouchers.length === 0}>
          {vouchers.length > 0 && (
            <ul className="mb-4 space-y-2">
              {vouchers.map((v) => (
                <li key={v.id} className="rounded-lg border border-slate-200">
                  <details className="group">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{v.scopeLabel}</p>
                        <p className="text-xs text-slate-500">
                          {[v.provider, v.reservationCode && `cód. ${v.reservationCode}`, v.price ? formatMoney(v.price, v.currency ?? "BRL") : null]
                            .filter(Boolean)
                            .join(" · ") || "Sem detalhes"}
                        </p>
                      </div>
                      <span className="flex items-center gap-3">
                        <Tag tone={VALUE_STATUS_TONE[v.status]}>{VALUE_STATUS_LABEL[v.status]}</Tag>
                        <span className="text-xs text-brand-700 group-open:hidden">editar</span>
                        <span className="hidden text-xs text-brand-700 group-open:inline">fechar</span>
                      </span>
                    </summary>
                    <div className="border-t border-slate-100 p-3">
                      <div className="mb-3 flex items-center justify-end">
                        <ConfirmDeleteButton
                          label="Excluir"
                          confirmTitle="Excluir este voucher?"
                          confirmDescription="Isso remove este voucher de custo do transporte."
                          deleteAction={deleteVoucherAction.bind(null, trip.id, booking.id, v.id)}
                          size="sm"
                        />
                      </div>
                      <form action={updateVoucherAction.bind(null, trip.id, booking.id, v.id)} className="grid gap-3 sm:grid-cols-6">
                        <TransportVoucherFields
                          trip={trip}
                          travelers={travelerOptions}
                          currencies={currencies}
                          voucher={v}
                          scopeLabel={v.scopeLabel}
                          attachment={
                            v.voucherDocumentId
                              ? { name: voucherDocById.get(v.voucherDocumentId) ?? "voucher", href: `/api/files/${trip.id}/${v.voucherDocumentId}` }
                              : null
                          }
                        />
                        <div className="sm:col-span-6">
                          <button className={btnPrimary}>Salvar voucher</button>
                        </div>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          {!groupVoucherExists || availableTravelerOptions.length > 0 ? (
            <form action={addVoucherAction.bind(null, trip.id, booking.id)} className="grid gap-3 sm:grid-cols-6">
              <TransportVoucherFields
                trip={trip}
                travelers={availableTravelerOptions}
                currencies={currencies}
                allowGroup={!groupVoucherExists}
              />
              <div className="sm:col-span-6">
                <button className={btnPrimary}>Adicionar voucher</button>
              </div>
            </form>
          ) : (
            <EmptyState>Já existe um voucher do grupo e de cada viajante deste transporte.</EmptyState>
          )}
        </AddPanel>
      </div>
    </div>
  );
}
