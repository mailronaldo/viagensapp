import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireMaster } from "@/lib/auth";
import { getLoginUrl } from "@/lib/origin";
import { formatDate } from "@/lib/format";
import {
  deleteClientAction,
  setClientActiveAction,
  startImpersonationAction,
  updateClientAction,
} from "@/app/actions/agency";
import { ResetPasswordForm } from "@/components/ClientForms";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Card, EmptyState, ErrorBanner, Field, btnGhost, btnPrimary, inputCls } from "@/components/ui";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireMaster();
  const { id } = await params;
  const { error } = await searchParams;

  const [client] = await db
    .select()
    .from(t.users)
    .where(and(eq(t.users.id, id), eq(t.users.role, "CLIENT")))
    .limit(1);
  if (!client) notFound();

  const [trips, travelers, loginUrl] = await Promise.all([
    db.select().from(t.trips).where(eq(t.trips.ownerId, client.id)).orderBy(desc(t.trips.startDate)),
    db.select().from(t.travelers).where(eq(t.travelers.clientId, client.id)).orderBy(asc(t.travelers.name)),
    getLoginUrl(),
  ]);

  return (
    <>
      <Link href="/agency" className="text-xs text-slate-500 hover:underline">
        ← Clientes
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="text-sm text-slate-500">
            {client.email}
            {!client.active && (
              <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">Desativado</span>
            )}
            {client.active && client.mustChangePassword && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                Aguardando 1º acesso
              </span>
            )}
          </p>
        </div>
        <form action={startImpersonationAction.bind(null, client.id)}>
          <button className={btnPrimary}>Acessar área do cliente</button>
        </form>
      </div>

      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-medium">Viagens ({trips.length})</h2>
            {trips.length === 0 ? (
              <EmptyState>Este cliente ainda não cadastrou viagens.</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {trips.map((trip) => (
                  <li key={trip.id} className="py-2 text-sm">
                    <p className="font-medium">{trip.title}</p>
                    <p className="text-xs text-slate-500">
                      {trip.destination} · {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Para ver ou editar uma viagem, use “Acessar área do cliente”.
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 font-medium">Viajantes cadastrados ({travelers.length})</h2>
            {travelers.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum viajante cadastrado.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 text-sm">
                {travelers.map((tr) => (
                  <li key={tr.id} className="rounded-full bg-slate-100 px-3 py-1">
                    {tr.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-medium">Dados do cliente</h2>
            <form action={updateClientAction.bind(null, client.id)} className="space-y-3">
              <Field label="Nome">
                <input name="name" required defaultValue={client.name} className={inputCls} />
              </Field>
              <Field label="E-mail (login)">
                <input name="email" type="email" required defaultValue={client.email} className={inputCls} />
              </Field>
              <button className={btnGhost}>Salvar</button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 font-medium">Acesso</h2>
            <ResetPasswordForm clientId={client.id} loginUrl={loginUrl} />
            <div className="mt-4 border-t border-slate-100 pt-4">
              <form action={setClientActiveAction.bind(null, client.id, !client.active)}>
                <button className={btnGhost}>{client.active ? "Desativar acesso" : "Reativar acesso"}</button>
              </form>
              <p className="mt-2 text-xs text-slate-400">
                {client.active
                  ? "Desativado, o cliente não consegue entrar. Os dados dele são mantidos."
                  : "O cliente está impedido de entrar até você reativar."}
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-medium">Excluir cliente</h2>
            {trips.length === 0 ? (
              <>
                <ConfirmDeleteButton
                  label="Excluir cliente"
                  confirmTitle="Excluir este cliente?"
                  confirmDescription="Isso remove o cadastro, as cidades e os viajantes dele. Não dá pra desfazer."
                  deleteAction={deleteClientAction.bind(null, client.id)}
                />
                <p className="mt-2 text-xs text-slate-400">
                  Sem viagens cadastradas, dá pra excluir este cliente.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Só é possível excluir se o cliente não tiver nenhuma viagem cadastrada.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
