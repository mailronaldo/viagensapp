import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";
import { listTravelerPasses } from "@/services/passes";
import { listTravelerTickets } from "@/services/tickets";
import { listClientCurrencyCodes } from "@/services/currencies";
import { deleteOwnerChipAction, upsertOwnerChipAction } from "@/app/actions/chips";
import { addPassAction, deletePassAction } from "@/app/actions/passes";
import { ChipFields, PassFields } from "@/components/TripFields";
import { SavedModal } from "@/components/SavedModal";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, btnPrimary } from "@/components/ui";

export const metadata = { title: "Dono da viagem" };

export default async function OwnerTravelerHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!trip.ownerIsTraveler) redirect(`/trips/${trip.id}/travelers`);

  const [[owner], chip, tickets, passes, currencies] = await Promise.all([
    db.select({ name: t.users.name, email: t.users.email }).from(t.users).where(eq(t.users.id, trip.ownerId)).limit(1),
    db.select().from(t.chips).where(and(eq(t.chips.tripId, trip.id), isNull(t.chips.travelerId))).limit(1).then(([c]) => c),
    listTravelerTickets(trip.id, null),
    listTravelerPasses(trip.id, null),
    listClientCurrencyCodes(trip.ownerId),
  ]);
  const attachment = chip?.receiptDocumentId
    ? await db
        .select({ fileName: t.documents.fileName })
        .from(t.documents)
        .where(eq(t.documents.id, chip.receiptDocumentId))
        .limit(1)
        .then(([doc]) => (doc ? { name: doc.fileName, href: `/api/files/${trip.id}/${chip.receiptDocumentId}` } : null))
    : null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/trips/${trip.id}/travelers`} className="text-xs text-slate-500 hover:underline">
        ← Viajantes
      </Link>
      {saved === "1" && (
        <SavedModal key={saved} show title="Chip salvo ✓" body="As informações de internet / telefonia foram salvas." cleanUrl={`/trips/${trip.id}/travelers/owner`} />
      )}
      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-1 text-lg font-medium">{owner?.name ?? "Dono da viagem"}</h2>
            <p className="text-sm text-slate-500">{owner?.email}</p>
          </Card>
        </div>

        <div className="space-y-4">
          <AddPanel title="Internet / chip" defaultOpen>
            {chip && (
              <div className="mb-3 flex items-center justify-end">
                <ConfirmDeleteButton
                  label="Remover chip"
                  confirmTitle="Remover este chip?"
                  confirmDescription="Isso remove o registro de internet / telefonia do cliente nesta viagem."
                  deleteAction={deleteOwnerChipAction.bind(null, trip.id)}
                  size="sm"
                />
              </div>
            )}
            {canWrite ? (
              <form action={upsertOwnerChipAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
                <ChipFields trip={trip} chip={chip} attachment={attachment} currencies={currencies} />
                <div className="sm:col-span-6">
                  <button className={btnPrimary}>Salvar</button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-slate-500">Você não tem permissão para editar esta viagem.</p>
            )}
          </AddPanel>

          <AddPanel title={`Ingressos${tickets.length > 0 ? ` (${tickets.length})` : ""}`}>
            {tickets.length === 0 ? (
              <EmptyState>Nenhum ingresso cadastrado ainda nesta viagem.</EmptyState>
            ) : (
              <ul className="space-y-2 text-sm">
                {tickets.map((row) => (
                  <li key={row.ticket.id}>
                    <Link href={`/trips/${trip.id}/itinerary/items/${row.ticket.itemId}`} className="block rounded-lg border border-slate-200 p-3 hover:border-brand-600">
                      <p className="font-medium">{row.itemTitle}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(row.itemDate)}
                        {row.ticket.provider ? ` · ${row.ticket.provider}` : ""}
                        {row.ticket.price ? ` · ${formatMoney(row.ticket.price, row.ticket.currency ?? "BRL")}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AddPanel>

          <AddPanel title={`Passes${passes.length > 0 ? ` (${passes.length})` : ""}`}>
            {passes.length > 0 && (
              <ul className="mb-4 space-y-2 text-sm">
                {passes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {[p.provider, `uso ${p.usedCount} de ${p.maxUses ?? "∞"}`, p.firstUsedAt ? `1º uso ${formatDate(p.firstUsedAt)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {canWrite && p.usedCount === 0 && (
                      <ConfirmDeleteButton
                        label="Excluir"
                        confirmTitle="Excluir este passe?"
                        confirmDescription="Isso remove o passe do dono da viagem."
                        deleteAction={deletePassAction.bind(null, trip.id, "owner", p.id)}
                        size="sm"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <form action={addPassAction.bind(null, trip.id, "owner")} className="grid gap-3 sm:grid-cols-6">
                <PassFields trip={trip} currencies={currencies} />
                <div className="sm:col-span-6">
                  <button className={btnPrimary}>Cadastrar passe</button>
                </div>
              </form>
            )}
          </AddPanel>
        </div>
      </div>
    </div>
  );
}
