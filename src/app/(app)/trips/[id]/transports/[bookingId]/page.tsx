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
import { listBookingSeats } from "@/services/booking-seats";
import { listBookingBaggages } from "@/services/booking-baggages";
import { listPayments } from "@/services/payments";
import { deleteBookingAction, updateBookingAction } from "@/app/actions/bookings";
import { addVoucherAction, deleteVoucherAction, updateVoucherAction } from "@/app/actions/transport-vouchers";
import { addLegAction, deleteLegAction, updateLegAction } from "@/app/actions/booking-legs";
import { addSeatAction, deleteSeatAction, updateSeatAction } from "@/app/actions/booking-seats";
import { addBaggageAction, deleteBaggageAction, updateBaggageAction } from "@/app/actions/booking-baggages";
import { addPaymentAction, updatePaymentAction } from "@/app/actions/payments";
import {
  BookingBaggageFields,
  BookingFields,
  BookingSeatFields,
  LegFields,
  PaymentFields,
  PaymentList,
  TransportVoucherFields,
  legOptionLabel,
} from "@/components/TripFields";
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

  const [cities, types, currencies, travelerOptions, [owner]] = await Promise.all([
    getTripCities(trip.id),
    listBookingTypes(),
    listClientCurrencyCodes(trip.ownerId),
    listTripTravelerOptions(trip),
    db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, trip.ownerId)).limit(1),
  ]);
  const neighborhoods = await listNeighborhoodsForCities(cities.map((c) => c.id));
  const legs = await listBookingLegs(bookingId);
  const legIds = legs.map((leg) => leg.id);
  const [seats, baggages] = await Promise.all([listBookingSeats(legIds), listBookingBaggages(legIds)]);
  const legLabelById = new Map(legs.map((leg, i) => [leg.id, legOptionLabel(leg, i)]));
  const vouchers = await listBookingVouchers(bookingId, owner?.name ?? "Dono");
  const voucherDocIds = vouchers.map((v) => v.voucherDocumentId).filter((docId): docId is string => !!docId);
  const voucherDocs = voucherDocIds.length
    ? await db.select({ id: t.documents.id, fileName: t.documents.fileName }).from(t.documents).where(inArray(t.documents.id, voucherDocIds))
    : [];
  const voucherDocById = new Map(voucherDocs.map((d) => [d.id, d.fileName]));
  const usedTravelerIds = new Set(vouchers.filter((v) => !v.isGroup).map((v) => v.travelerId));
  const availableTravelerOptions = travelerOptions.filter((tr) => !usedTravelerIds.has(tr.id));
  const groupVoucherExists = vouchers.some((v) => v.isGroup);
  const travelerPayerName = new Map(travelerOptions.map((tr) => [tr.id ?? "owner", tr.name]));
  const voucherPaymentsByVoucher = new Map(
    await Promise.all(vouchers.map(async (v) => [v.id, await listPayments("TRANSPORT_VOUCHER", v.id)] as const)),
  );
  const editBack = `/trips/${trip.id}/transports/${booking.id}${day ? `?day=${day}` : ""}`;

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
          <BookingFields cities={cities} types={types} neighborhoods={neighborhoods} booking={booking} legs={legs} />
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
                          <p className="font-medium">
                            Trecho {i + 1}
                            {leg.code ? <span className="font-normal text-slate-500"> — {leg.code}</span> : null}
                          </p>
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
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="mb-2 text-xs font-medium text-slate-600">
                          Pagamentos{(voucherPaymentsByVoucher.get(v.id)?.length ?? 0) > 0 ? ` (${voucherPaymentsByVoucher.get(v.id)!.length})` : ""}
                        </p>
                        <PaymentList
                          payments={voucherPaymentsByVoucher.get(v.id) ?? []}
                          travelerName={travelerPayerName}
                          travelers={travelerOptions}
                          currency={v.currency ?? trip.baseCurrency}
                          editAction={(paymentId) => updatePaymentAction.bind(null, trip.id, "TRANSPORT_VOUCHER", v.id, paymentId, editBack)}
                        />
                        <form action={addPaymentAction.bind(null, trip.id, "TRANSPORT_VOUCHER", v.id, editBack)} className="grid gap-3 sm:grid-cols-6">
                          <PaymentFields
                            travelers={travelerOptions}
                            currency={v.currency ?? trip.baseCurrency}
                            defaultCostWho={v.isGroup ? "group" : v.travelerId ?? "owner"}
                          />
                          <div className="sm:col-span-6">
                            <button className={btnPrimary}>Lançar pagamento</button>
                          </div>
                        </form>
                      </div>
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

      <div className="mt-6">
        <AddPanel title={`Assentos${seats.length > 0 ? ` (${seats.length})` : ""}`} defaultOpen={false}>
          {legs.length === 0 ? (
            <EmptyState>Adicione um trecho no painel “Trechos” antes de lançar assentos.</EmptyState>
          ) : (
            <>
              {seats.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {seats.map((s) => (
                    <li key={s.id} className="rounded-lg border border-slate-200">
                      <details className="group">
                        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium">{s.seat}</p>
                            <p className="text-xs text-slate-500">
                              {legLabelById.get(s.bookingLegId) ?? "Trecho"} · {travelerPayerName.get(s.travelerId ?? "owner") ?? "Viajante removido"}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1">
                            <Pencil className="size-4 text-slate-400" aria-hidden />
                            <ConfirmDeleteButton
                              label="Excluir"
                              confirmTitle="Excluir este assento?"
                              confirmDescription="Isso remove este assento lançado."
                              deleteAction={deleteSeatAction.bind(null, trip.id, booking.id, s.id)}
                              size="sm"
                            />
                          </span>
                        </summary>
                        <div className="border-t border-slate-100 p-3">
                          <form action={updateSeatAction.bind(null, trip.id, booking.id, s.id)} className="grid gap-3 sm:grid-cols-6">
                            <BookingSeatFields
                              legs={legs}
                              travelers={travelerOptions}
                              seat={{
                                legLabel: legLabelById.get(s.bookingLegId) ?? "Trecho",
                                travelerName: travelerPayerName.get(s.travelerId ?? "owner") ?? "Viajante removido",
                                seat: s.seat,
                              }}
                            />
                            <div className="sm:col-span-6">
                              <button className={btnPrimary}>Salvar assento</button>
                            </div>
                          </form>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addSeatAction.bind(null, trip.id, booking.id)} className="grid gap-3 sm:grid-cols-6">
                <BookingSeatFields legs={legs} travelers={travelerOptions} />
                <div className="sm:col-span-6">
                  <button className={btnPrimary}>Adicionar assento</button>
                </div>
              </form>
            </>
          )}
        </AddPanel>
      </div>

      <div className="mt-6">
        <AddPanel title={`Bagagens${baggages.length > 0 ? ` (${baggages.length})` : ""}`} defaultOpen={false}>
          {legs.length === 0 ? (
            <EmptyState>Adicione um trecho no painel “Trechos” antes de lançar bagagens.</EmptyState>
          ) : (
            <>
              {baggages.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {baggages.map((bg) => (
                    <li key={bg.id} className="rounded-lg border border-slate-200">
                      <details className="group">
                        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium">{travelerPayerName.get(bg.travelerId ?? "owner") ?? "Viajante removido"}</p>
                            <p className="text-xs text-slate-500">
                              {legLabelById.get(bg.bookingLegId) ?? "Trecho"} ·{" "}
                              {[
                                bg.bagIncluded ? "Bolsa/mochila" : null,
                                bg.smallSuitcaseIncluded ? "Mala pequena" : null,
                                bg.checkedSuitcaseCount > 0 ? `${bg.checkedSuitcaseCount}x mala despachada` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Sem bagagem incluída"}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1">
                            <Pencil className="size-4 text-slate-400" aria-hidden />
                            <ConfirmDeleteButton
                              label="Excluir"
                              confirmTitle="Excluir esta bagagem?"
                              confirmDescription="Isso remove este lançamento de bagagem."
                              deleteAction={deleteBaggageAction.bind(null, trip.id, booking.id, bg.id)}
                              size="sm"
                            />
                          </span>
                        </summary>
                        <div className="border-t border-slate-100 p-3">
                          <form action={updateBaggageAction.bind(null, trip.id, booking.id, bg.id)} className="grid gap-3 sm:grid-cols-6">
                            <BookingBaggageFields
                              legs={legs}
                              travelers={travelerOptions}
                              baggage={{
                                legLabel: legLabelById.get(bg.bookingLegId) ?? "Trecho",
                                travelerName: travelerPayerName.get(bg.travelerId ?? "owner") ?? "Viajante removido",
                                bagIncluded: bg.bagIncluded,
                                smallSuitcaseIncluded: bg.smallSuitcaseIncluded,
                                checkedSuitcaseCount: bg.checkedSuitcaseCount,
                              }}
                            />
                            <div className="sm:col-span-6">
                              <button className={btnPrimary}>Salvar bagagem</button>
                            </div>
                          </form>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addBaggageAction.bind(null, trip.id, booking.id)} className="grid gap-3 sm:grid-cols-6">
                <BookingBaggageFields legs={legs} travelers={travelerOptions} />
                <div className="sm:col-span-6">
                  <button className={btnPrimary}>Adicionar bagagem</button>
                </div>
              </form>
            </>
          )}
        </AddPanel>
      </div>
    </div>
  );
}
