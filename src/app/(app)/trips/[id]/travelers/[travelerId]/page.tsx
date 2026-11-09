import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";
import { getLoginUrl } from "@/lib/origin";
import { listTravelerPasses } from "@/services/passes";
import { listTravelerTickets } from "@/services/tickets";
import { listClientCurrencyCodes } from "@/services/currencies";
import { listExpenseCategories } from "@/services/catalogs";
import { deleteChipAction, upsertChipAction } from "@/app/actions/chips";
import {
  setTravelerAccessActiveFromTripAction,
  setTravelerPermissionFromTripAction,
  updateTravelerFromTripAction,
} from "@/app/actions/travelers";
import { addPassAction, deletePassAction, updatePassAction } from "@/app/actions/passes";
import { deleteInsuranceAction, upsertInsuranceAction } from "@/app/actions/travel-insurance";
import { getTravelerInsurance } from "@/services/travel-insurance";
import { ChipFields, InsuranceFields, PassFields } from "@/components/TripFields";
import { TravelerAccessForm } from "@/components/TravelerAccess";
import { SavedModal } from "@/components/SavedModal";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, Tag, btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { VALUE_STATUS_LABEL, VALUE_STATUS_TONE } from "@/lib/labels";

export const metadata = { title: "Viajante" };

export default async function TravelerHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; travelerId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id, travelerId } = await params;
  const { error, saved } = await searchParams;
  const { trip, role, canWrite } = await requireTripAccess(id);

  const [linked] = await db
    .select({ traveler: t.travelers, permission: t.tripTravelers.permission })
    .from(t.tripTravelers)
    .innerJoin(t.travelers, eq(t.travelers.id, t.tripTravelers.travelerId))
    .where(and(eq(t.tripTravelers.tripId, trip.id), eq(t.tripTravelers.travelerId, travelerId)))
    .limit(1);
  if (!linked) notFound();
  const { traveler, permission } = linked;

  const [chip, [login], tickets, passes, currencies, categories, insurance] = await Promise.all([
    db.select().from(t.chips).where(and(eq(t.chips.tripId, trip.id), eq(t.chips.travelerId, travelerId))).limit(1).then(([c]) => c),
    traveler.userId
      ? db.select({ active: t.users.active, mustChangePassword: t.users.mustChangePassword }).from(t.users).where(eq(t.users.id, traveler.userId)).limit(1)
      : Promise.resolve([null]),
    listTravelerTickets(trip.id, travelerId),
    listTravelerPasses(trip.id, travelerId),
    listClientCurrencyCodes(trip.ownerId),
    listExpenseCategories(),
    getTravelerInsurance(trip.id, travelerId),
  ]);
  const attachment = chip?.receiptDocumentId
    ? await db
        .select({ fileName: t.documents.fileName })
        .from(t.documents)
        .where(eq(t.documents.id, chip.receiptDocumentId))
        .limit(1)
        .then(([doc]) => (doc ? { name: doc.fileName, href: `/api/files/${trip.id}/${chip.receiptDocumentId}` } : null))
    : null;
  const policyAttachment = insurance?.policyDocumentId
    ? await db
        .select({ fileName: t.documents.fileName })
        .from(t.documents)
        .where(eq(t.documents.id, insurance.policyDocumentId))
        .limit(1)
        .then(([doc]) => (doc ? { name: doc.fileName, href: `/api/files/${trip.id}/${insurance.policyDocumentId}` } : null))
    : null;
  const loginUrl = await getLoginUrl();
  const canEditCadastro = canWrite;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/trips/${trip.id}/travelers`} className="text-xs text-slate-500 hover:underline">
        ← Viajantes
      </Link>
      {saved === "1" && (
        <SavedModal key={saved} show title="Chip salvo ✓" body="As informações de internet / telefonia foram salvas." cleanUrl={`/trips/${trip.id}/travelers/${travelerId}`} />
      )}
      {saved === "cadastro" && (
        <SavedModal key={saved} show title="Cadastro salvo ✓" body="Os dados do viajante foram atualizados." cleanUrl={`/trips/${trip.id}/travelers/${travelerId}`} />
      )}
      {saved === "seguro" && (
        <SavedModal key={saved} show title="Seguro salvo ✓" body="Os dados do seguro viagem foram salvos." cleanUrl={`/trips/${trip.id}/travelers/${travelerId}`} />
      )}
      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-lg font-medium">{traveler.name}</h2>
            {canEditCadastro ? (
              <form action={updateTravelerFromTripAction.bind(null, trip.id, travelerId)} className="grid gap-3 sm:grid-cols-6">
                <Field label="Nome completo" className="sm:col-span-4">
                  <input name="name" required defaultValue={traveler.name} className={inputCls} />
                </Field>
                <Field label="Nascimento" className="sm:col-span-2">
                  <input name="birthDate" type="date" defaultValue={traveler.birthDate ?? ""} className={inputCls} />
                </Field>
                <Field label="E-mail" className="sm:col-span-3">
                  <input name="email" type="email" defaultValue={traveler.email ?? ""} readOnly={!!traveler.userId} className={inputCls} />
                </Field>
                <Field label="Telefone / WhatsApp" className="sm:col-span-3">
                  <input name="phone" inputMode="tel" defaultValue={traveler.phone ?? ""} className={inputCls} />
                </Field>
                <Field label="Documento (passaporte, RG ou CPF)" className="sm:col-span-6">
                  <input name="documentNumber" defaultValue={traveler.documentNumber ?? ""} className={inputCls} />
                </Field>
                <Field label="Observações" className="sm:col-span-6">
                  <textarea name="notes" rows={3} defaultValue={traveler.notes ?? ""} className={inputCls} />
                </Field>
                <div className="sm:col-span-6">
                  <button className={btnPrimary}>Salvar cadastro</button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-slate-600">
                {[traveler.email, traveler.phone, traveler.birthDate ? `nasc. ${formatDate(traveler.birthDate)}` : null]
                  .filter(Boolean)
                  .join(" · ") || "Sem contato cadastrado"}
              </p>
            )}
          </Card>

          <div className="mt-6">
            <AddPanel title="Seguro viagem">
              {insurance && (
                <div className="mb-3 flex items-center justify-end">
                  <ConfirmDeleteButton
                    label="Remover seguro"
                    confirmTitle="Remover este seguro?"
                    confirmDescription="Isso remove a apólice de seguro viagem deste viajante nesta viagem."
                    deleteAction={deleteInsuranceAction.bind(null, trip.id, travelerId)}
                    size="sm"
                  />
                </div>
              )}
              {canWrite ? (
                <form action={upsertInsuranceAction.bind(null, trip.id, travelerId)} className="grid gap-3 sm:grid-cols-6">
                  <InsuranceFields trip={trip} insurance={insurance} attachment={policyAttachment} currencies={currencies} categories={categories} />
                  <div className="sm:col-span-6">
                    <button className={btnPrimary}>Salvar</button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-slate-500">Você não tem permissão para editar esta viagem.</p>
              )}
            </AddPanel>
          </div>
        </div>

        <div className="space-y-4">
          {canWrite && (
            <Card>
              <h3 className="mb-2 text-sm font-medium">Permissão nesta viagem</h3>
              <p className="mb-3 text-xs text-slate-500">
                Total = vira administrador da viagem, como o cliente. Leitura = só vê o painel dele.
              </p>
              <form action={setTravelerPermissionFromTripAction.bind(null, trip.id, travelerId)} className="flex items-center gap-2">
                <select name="permission" defaultValue={permission} className={inputCls}>
                  <option value="READ">Apenas leitura</option>
                  <option value="FULL">Permissão total</option>
                </select>
                <button className={btnPrimary}>Salvar</button>
              </form>
            </Card>
          )}

          <AddPanel title="Internet / chip" defaultOpen>

            {chip && (
              <div className="mb-3 flex items-center justify-end">
                <ConfirmDeleteButton
                  label="Remover chip"
                  confirmTitle="Remover este chip?"
                  confirmDescription="Isso remove o registro de internet / telefonia deste viajante nesta viagem."
                  deleteAction={deleteChipAction.bind(null, trip.id, travelerId)}
                  size="sm"
                />
              </div>
            )}
            {canWrite ? (
              <form action={upsertChipAction.bind(null, trip.id, travelerId)} className="grid gap-3 sm:grid-cols-6">
                <ChipFields trip={trip} chip={chip} attachment={attachment} currencies={currencies} categories={categories} />
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
                      <Tag tone={VALUE_STATUS_TONE[row.ticket.status]}>{VALUE_STATUS_LABEL[row.ticket.status]}</Tag>
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
                  <li key={p.id} className="rounded-lg border border-slate-200">
                    <details className="group">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-slate-500">
                            {[p.provider, `uso ${p.usedCount} de ${p.maxUses ?? "∞"}`, p.firstUsedAt ? `1º uso ${formatDate(p.firstUsedAt)}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <Tag tone={VALUE_STATUS_TONE[p.status]}>{VALUE_STATUS_LABEL[p.status]}</Tag>
                        </div>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="text-xs text-brand-700 group-open:hidden">editar</span>
                          <span className="hidden text-xs text-brand-700 group-open:inline">fechar</span>
                        </span>
                      </summary>
                      {canWrite && (
                        <div className="border-t border-slate-100 p-3">
                          {p.usedCount === 0 && (
                            <div className="mb-3 flex items-center justify-end">
                              <ConfirmDeleteButton
                                label="Excluir"
                                confirmTitle="Excluir este passe?"
                                confirmDescription="Isso remove o passe deste viajante."
                                deleteAction={deletePassAction.bind(null, trip.id, travelerId, p.id)}
                                size="sm"
                              />
                            </div>
                          )}
                          <form action={updatePassAction.bind(null, trip.id, travelerId, p.id)} className="grid gap-3 sm:grid-cols-6">
                            <PassFields trip={trip} currencies={currencies} categories={categories} pass={p} />
                            <div className="sm:col-span-6">
                              <button className={btnPrimary}>Salvar passe</button>
                            </div>
                          </form>
                        </div>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <form action={addPassAction.bind(null, trip.id, travelerId)} className="grid gap-3 sm:grid-cols-6">
                <PassFields trip={trip} currencies={currencies} categories={categories} />
                <div className="sm:col-span-6">
                  <button className={btnPrimary}>Cadastrar passe</button>
                </div>
              </form>
            )}
          </AddPanel>

          {role === "OWNER" && (
            <AddPanel title="Gestor de acesso" defaultOpen>

              <p className="mb-3 text-sm text-slate-600">
                Com o acesso, {traveler.name.split(" ")[0]} entra com o e-mail do cadastro e vê, somente para
                leitura, o roteiro, as agendas, transportes, hospedagens e os documentos liberados para ele nas
                viagens em que estiver no grupo.
              </p>
              {traveler.userId ? (
                <p className="mb-3 text-sm">
                  Status:{" "}
                  <strong className={login?.active ? "text-emerald-700" : "text-rose-700"}>
                    {login?.active ? "ativo" : "desativado"}
                  </strong>
                  {login?.mustChangePassword ? " · ainda não trocou a senha temporária" : ""}
                </p>
              ) : !traveler.email ? (
                <p className="mb-3 text-sm text-amber-700">Cadastre o e-mail do viajante acima e salve para poder gerar o acesso.</p>
              ) : null}
              {traveler.email && <TravelerAccessForm travelerId={traveler.id} hasAccess={!!traveler.userId} loginUrl={loginUrl} />}
              {traveler.userId && (
                <form action={setTravelerAccessActiveFromTripAction.bind(null, trip.id, travelerId, !login?.active)} className="mt-3">
                  <button className={btnGhost}>{login?.active ? "Desativar acesso" : "Reativar acesso"}</button>
                </form>
              )}
            </AddPanel>
          )}
        </div>
      </div>
    </div>
  );
}
