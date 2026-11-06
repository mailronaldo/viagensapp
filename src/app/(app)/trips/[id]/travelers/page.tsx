import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDate } from "@/lib/format";
import {
  createAndLinkTravelerAction,
  linkTravelerAction,
  unlinkTravelerAction,
} from "@/app/actions/travelers";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import {
  AddPanel,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Tag,
  btnPrimary,
  inputCls,
} from "@/components/ui";

export const metadata = { title: "Viajantes da viagem" };

function PermissionField() {
  return (
    <Field label="Permissão" hint="Total = vira administrador da viagem, como o cliente.">
      <select name="permission" defaultValue="READ" className={inputCls}>
        <option value="READ">Apenas leitura</option>
        <option value="FULL">Permissão total</option>
      </select>
    </Field>
  );
}

export default async function TripTravelersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);

  const [linked, ownerTravelers, [owner]] = await Promise.all([
    db
      .select({ traveler: t.travelers, permission: t.tripTravelers.permission })
      .from(t.tripTravelers)
      .innerJoin(t.travelers, eq(t.travelers.id, t.tripTravelers.travelerId))
      .where(eq(t.tripTravelers.tripId, trip.id))
      .orderBy(asc(t.travelers.name)),
    // Viajantes do cliente dono da viagem: os candidatos a entrar no grupo.
    db.select().from(t.travelers).where(eq(t.travelers.clientId, trip.ownerId)).orderBy(asc(t.travelers.name)),
    trip.ownerIsTraveler
      ? db.select({ name: t.users.name, email: t.users.email }).from(t.users).where(eq(t.users.id, trip.ownerId)).limit(1)
      : [null],
  ]);
  const linkedIds = new Set(linked.map((l) => l.traveler.id));
  const available = ownerTravelers.filter((tr) => !linkedIds.has(tr.id));

  return (
    <>
      <ErrorBanner message={error} />

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-600">
          O grupo desta viagem ({linked.length}). Com permissão total, o viajante vira administrador da viagem;
          com apenas leitura, só vê o painel dele.
        </p>
        <Link href={`/traveler/trips/${trip.id}`} className="text-sm text-brand-700 hover:underline">
          Ver o painel do viajante
        </Link>
      </div>

      {canWrite && (
        <>
          {available.length > 0 && (
            <AddPanel title="Incluir viajantes já cadastrados" defaultOpen={linked.length === 0}>
              <form action={linkTravelerAction.bind(null, trip.id)} className="space-y-3">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {available.map((a) => (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-brand-600">
                        <input type="checkbox" name="travelerIds" value={a.id} />
                        <span className="min-w-0">
                          <span className="block truncate">{a.name}</span>
                          {a.email && <span className="block truncate text-xs text-slate-500">{a.email}</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-end gap-3">
                  <PermissionField />
                  <button className={btnPrimary}>Incluir selecionados</button>
                </div>
              </form>
            </AddPanel>
          )}

          <AddPanel title="Cadastrar novo viajante e incluir" defaultOpen={ownerTravelers.length === 0}>
            <form action={createAndLinkTravelerAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
              <Field label="Nome completo" className="sm:col-span-4">
                <input name="name" required className={inputCls} />
              </Field>
              <Field label="Nascimento" className="sm:col-span-2">
                <input name="birthDate" type="date" className={inputCls} />
              </Field>
              <Field label="E-mail" className="sm:col-span-3" hint="Necessário para gerar o acesso ao painel.">
                <input name="email" type="email" className={inputCls} />
              </Field>
              <Field label="Telefone / WhatsApp" className="sm:col-span-3">
                <input name="phone" inputMode="tel" placeholder="+55 11 99999-8888" className={inputCls} />
              </Field>
              <Field label="Documento (passaporte, RG ou CPF)" className="sm:col-span-6">
                <input name="documentNumber" className={inputCls} />
              </Field>
              <div className="sm:col-span-3">
                <PermissionField />
              </div>
              <div className="sm:col-span-6">
                <button className={btnPrimary}>Salvar e incluir na viagem</button>
              </div>
            </form>
          </AddPanel>
        </>
      )}

      {owner && (
        <Card className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 !p-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              <Link href={`/trips/${trip.id}/travelers/owner`} className="text-brand-700 hover:underline">
                {owner.name}
              </Link>{" "}
              <Tag tone="ok">dono da viagem</Tag>
            </p>
            <p className="text-xs text-slate-500">{owner.email}</p>
          </div>
        </Card>
      )}

      {linked.length === 0 ? (
        <EmptyState>Ninguém no grupo desta viagem ainda.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {linked.map(({ traveler: tr, permission }) => (
            <li key={tr.id}>
              <Card className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 !p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <Link href={`/trips/${trip.id}/travelers/${tr.id}`} className="text-brand-700 hover:underline">
                      {tr.name}
                    </Link>{" "}
                    {tr.userId ? <Tag tone="ok">com acesso</Tag> : <Tag tone="neutral">sem acesso</Tag>}{" "}
                    {permission === "FULL" ? (
                      <Tag tone="ok">permissão total</Tag>
                    ) : (
                      <Tag tone="neutral">apenas leitura</Tag>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {[tr.email, tr.phone, tr.birthDate ? `nasc. ${formatDate(tr.birthDate)}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Sem contato cadastrado"}
                  </p>
                </div>
                {canWrite && (
                  <ConfirmDeleteButton
                    label="Remover do grupo"
                    confirmTitle="Remover este viajante do grupo?"
                    confirmDescription={`${tr.name} sai do grupo desta viagem. O cadastro dele continua existindo e pode ser incluído de novo depois.`}
                    deleteAction={unlinkTravelerAction.bind(null, trip.id, tr.id)}
                  />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
