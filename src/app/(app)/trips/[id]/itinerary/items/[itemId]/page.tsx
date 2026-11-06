import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatMoney } from "@/lib/format";
import { getTripCities } from "@/services/cities";
import { getActivityPoints, getActivityRegions } from "@/services/activity-points";
import { listActivityTypes } from "@/services/catalogs";
import { getActivityTickets } from "@/services/tickets";
import { getItemPassUsages, listAvailablePassesForItem } from "@/services/passes";
import { listTripTravelerOptions } from "@/services/trip-travelers";
import { deleteItemAction, removeReservationAction, updateItemAction } from "@/app/actions/items";
import {
  addActivityPointAction,
  addActivityRegionAction,
  deleteActivityPointAction,
  deleteActivityRegionAction,
} from "@/app/actions/activity-points";
import { addTicketAction, deleteTicketAction } from "@/app/actions/tickets";
import { removeItemPassUsageAction, useItemPassAction } from "@/app/actions/passes";
import { ItemMainFields, ReservationFields, TicketFields } from "@/components/TripFields";
import { ActivityPointCard } from "@/components/ActivityPointCard";
import { ActivityRegionCard } from "@/components/ActivityRegionCard";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { SavedModal } from "@/components/SavedModal";
import { AddPanel, Card, EmptyState, ErrorBanner, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Editar atividade" };

const FORM_ID = "item-edit-form";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id, itemId } = await params;
  const { error, saved } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!canWrite) redirect(`/trips/${id}/itinerary`);

  const [item] = await db
    .select()
    .from(t.itineraryItems)
    .where(and(eq(t.itineraryItems.id, itemId), eq(t.itineraryItems.tripId, trip.id)))
    .limit(1);
  if (!item) notFound();

  const [cities, activityTypes, doc, resDoc, pois, tips, regions, travelerOptions, [owner]] = await Promise.all([
    getTripCities(trip.id),
    listActivityTypes(),
    item.ticketDocumentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, item.ticketDocumentId)).limit(1)
      : Promise.resolve([]),
    item.reservationDocumentId
      ? db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, item.reservationDocumentId)).limit(1)
      : Promise.resolve([]),
    getActivityPoints(itemId, "POI"),
    getActivityPoints(itemId, "TIP"),
    getActivityRegions(itemId),
    listTripTravelerOptions(trip),
    db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, trip.ownerId)).limit(1),
  ]);
  const [tickets, availablePasses, passUsages] = await Promise.all([
    getActivityTickets(itemId, owner?.name ?? "Dono"),
    listAvailablePassesForItem(trip.id, itemId),
    getItemPassUsages(itemId),
  ]);
  const attachment = doc[0]
    ? { name: doc[0].fileName, href: `/api/files/${trip.id}/${item.ticketDocumentId}` }
    : null;
  const reservationAttachment = resDoc[0]
    ? { name: resDoc[0].fileName, href: `/api/files/${trip.id}/${item.reservationDocumentId}` }
    : null;
  const ticketedTravelerIds = new Set(tickets.map((ti) => ti.travelerId));
  const travelersWithoutTicket = travelerOptions.filter((tr) => !ticketedTravelerIds.has(tr.id));
  const back = `/trips/${trip.id}/itinerary/day/${item.date}`;
  const hasReservation = !!(
    item.reservationProvider ||
    item.reservationCode ||
    item.reservationPrice ||
    item.reservationDetails ||
    item.reservationDocumentId
  );

  return (
    <div className="mx-auto max-w-5xl">
      {(saved === "activity" || saved === "reserva") && (
        <SavedModal
          key={saved}
          show
          title={saved === "activity" ? "Atividade salva ✓" : "Reserva salva ✓"}
          body={saved === "activity" ? "As alterações da atividade foram salvas." : "Os dados da reserva foram salvos."}
          cleanUrl={`/trips/${trip.id}/itinerary/items/${itemId}`}
        />
      )}
      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Editar atividade</h2>
              <ConfirmDeleteButton
                label="Excluir atividade"
                confirmTitle="Excluir esta atividade?"
                confirmDescription="Isso remove a atividade, a reserva, os pontos de interesse, as tips e a região cadastrados nela. Não dá pra desfazer."
                deleteAction={deleteItemAction.bind(null, trip.id, item.id, item.date)}
              />
            </div>
            <form id={FORM_ID} action={updateItemAction.bind(null, trip.id, item.id)} className="grid gap-3 sm:grid-cols-6">
              <ItemMainFields trip={trip} cities={cities} types={activityTypes} item={item} attachment={attachment} />
            </form>
          </Card>
          <div className="mt-4 flex gap-2">
            <button form={FORM_ID} name="stayOnPage" value="activity" className={btnPrimary}>
              Salvar alterações
            </button>
            <Link href={back} className={btnGhost}>
              Cancelar
            </Link>
          </div>

          <div id="reserva" className="mt-6">
            <AddPanel
              title="Reserva desta atividade"
              defaultOpen={hasReservation}
              headerExtra={
                hasReservation ? (
                  <ConfirmDeleteButton
                    label="Excluir reserva"
                    confirmTitle="Excluir a reserva desta atividade?"
                    confirmDescription="A atividade e o arquivo do voucher (se tiver) continuam — só os dados da reserva somem."
                    deleteAction={removeReservationAction.bind(null, trip.id, item.id, "edit")}
                    size="sm"
                  />
                ) : undefined
              }
            >
              <ReservationFields trip={trip} item={item} reservationAttachment={reservationAttachment} formId={FORM_ID} />
              <div className="mt-3">
                <button form={FORM_ID} name="stayOnPage" value="reserva" className={btnPrimary}>
                  Salvar reserva
                </button>
              </div>
            </AddPanel>
          </div>

          <div className="mt-6">
            <AddPanel title={`Ingressos${tickets.length > 0 ? ` (${tickets.length})` : ""}`} defaultOpen={false}>
              {tickets.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {tickets.map((ti) => (
                    <li key={ti.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{ti.travelerName}</p>
                        <p className="text-xs text-slate-500">
                          {[ti.provider, ti.ticketNumber && `nº ${ti.ticketNumber}`, ti.price ? formatMoney(ti.price, ti.currency ?? "BRL") : null]
                            .filter(Boolean)
                            .join(" · ") || "Sem detalhes"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {ti.voucherDocumentId && (
                          <a href={`/api/files/${trip.id}/${ti.voucherDocumentId}`} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">
                            📎 voucher
                          </a>
                        )}
                        <ConfirmDeleteButton
                          label="Excluir"
                          confirmTitle="Excluir este ingresso?"
                          confirmDescription="Isso remove o ingresso deste viajante nesta atividade."
                          deleteAction={deleteTicketAction.bind(null, trip.id, itemId, ti.id)}
                          size="sm"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {travelersWithoutTicket.length === 0 ? (
                <EmptyState>Todos os viajantes do grupo já têm ingresso nesta atividade.</EmptyState>
              ) : (
                <form action={addTicketAction.bind(null, trip.id, itemId)} className="grid gap-3 sm:grid-cols-6">
                  <TicketFields trip={trip} travelers={travelersWithoutTicket} />
                  <div className="sm:col-span-6">
                    <button className={btnPrimary}>Adicionar ingresso</button>
                  </div>
                </form>
              )}
            </AddPanel>
          </div>

          <div className="mt-6">
            <AddPanel title={`Passe${passUsages.length > 0 ? ` (${passUsages.length})` : ""}`} defaultOpen={false}>
              {passUsages.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {passUsages.map((u) => (
                    <li key={u.usage.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{u.pass.name}</p>
                        <p className="text-xs text-slate-500">
                          {u.travelerName ?? "Dono da viagem"} · uso {u.usedCount} de {u.pass.maxUses ?? "∞"}
                        </p>
                      </div>
                      <ConfirmDeleteButton
                        label="Remover uso"
                        confirmTitle="Remover este uso do passe?"
                        confirmDescription="O passe volta a ter essa vaga disponível."
                        deleteAction={removeItemPassUsageAction.bind(null, trip.id, itemId, u.usage.id)}
                        size="sm"
                      />
                    </li>
                  ))}
                </ul>
              )}
              {availablePasses.length === 0 ? (
                <EmptyState>Nenhum passe disponível. Cadastre um na página do viajante.</EmptyState>
              ) : (
                <form action={useItemPassAction.bind(null, trip.id, itemId)} className="flex flex-wrap items-end gap-3">
                  <select name="passId" required className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-ring/15">
                    <option value="">Selecione…</option>
                    {availablePasses.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.travelerName ?? "dono da viagem"} ({p.usedCount}/{p.maxUses ?? "∞"})
                      </option>
                    ))}
                  </select>
                  <button className={btnPrimary}>Usar passe nesta atividade</button>
                </form>
              )}
            </AddPanel>
          </div>
        </div>

        <div className="space-y-4">
          <ActivityPointCard
            title="Pontos de interesse"
            hint="Lugares pra visitar nesta atividade ou nas proximidades."
            items={pois}
            addAction={addActivityPointAction.bind(null, trip.id, itemId, "POI")}
            deleteAction={deleteActivityPointAction.bind(null, trip.id, itemId)}
            ai={{ kind: "POI", tripId: trip.id, itemId }}
          />

          <ActivityPointCard
            title="Tips"
            hint="Opções alternativas, caso ainda não tenha reserva ou certeza do que fazer."
            items={tips}
            addAction={addActivityPointAction.bind(null, trip.id, itemId, "TIP")}
            deleteAction={deleteActivityPointAction.bind(null, trip.id, itemId)}
            showCategory
            ai={{ kind: "TIP", tripId: trip.id, itemId }}
          />

          <ActivityRegionCard
            items={regions}
            addAction={addActivityRegionAction.bind(null, trip.id, itemId)}
            deleteAction={deleteActivityRegionAction.bind(null, trip.id, itemId)}
          />
        </div>
      </div>
    </div>
  );
}
