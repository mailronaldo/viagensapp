import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireMaster } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { startImpersonationAction } from "@/app/actions/agency";
import { Card, EmptyState, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Agência · Clientes" };

export default async function AgencyDashboard() {
  await requireMaster();

  const [clients, tripCounts, travelerCounts] = await Promise.all([
    db
      .select()
      .from(t.users)
      .where(eq(t.users.role, "CLIENT"))
      .orderBy(asc(t.users.name)),
    db.select({ clientId: t.trips.ownerId, n: count() }).from(t.trips).groupBy(t.trips.ownerId),
    db
      .select({ clientId: t.travelers.clientId, n: count() })
      .from(t.travelers)
      .groupBy(t.travelers.clientId),
  ]);

  const trips = new Map(tripCounts.map((r) => [r.clientId, r.n]));
  const travelers = new Map(travelerCounts.map((r) => [r.clientId, r.n]));
  const totalTrips = [...trips.values()].reduce((a, b) => a + b, 0);
  const activeClients = clients.filter((c) => c.active).length;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes da agência</h1>
        <Link href="/agency/clients/new" className={btnPrimary}>
          Novo cliente
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">Clientes ativos</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{activeClients}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Clientes no total</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{clients.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Viagens cadastradas</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalTrips}</p>
        </Card>
      </div>

      {clients.length === 0 ? (
        <EmptyState>
          Nenhum cliente ainda.{" "}
          <Link href="/agency/clients/new" className="font-medium text-brand-700 hover:underline">
            Cadastrar o primeiro
          </Link>
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Situação</th>
                <th className="px-4 py-2 text-right font-medium">Viagens</th>
                <th className="px-4 py-2 text-right font-medium">Viajantes</th>
                <th className="px-4 py-2 font-medium">Desde</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">
                    <Link href={`/agency/clients/${c.id}`} className="font-medium text-brand-800 hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-xs text-slate-400">{c.email}</span>
                  </td>
                  <td className="px-4 py-2">
                    {!c.active ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">Desativado</span>
                    ) : c.mustChangePassword ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        Aguardando 1º acesso
                      </span>
                    ) : (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800">Ativo</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{trips.get(c.id) ?? 0}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{travelers.get(c.id) ?? 0}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                    {formatDate(c.createdAt.toISOString().slice(0, 10))}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={startImpersonationAction.bind(null, c.id)}>
                      <button className={btnGhost}>Acessar área</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
