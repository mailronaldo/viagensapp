import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { addRequesterAction } from "@/app/actions/requesters";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Solicitantes" };

export default async function RequestersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireClient();
  const { error } = await searchParams;

  const requesters = await db
    .select()
    .from(t.requesters)
    .where(eq(t.requesters.clientId, user.id))
    .orderBy(asc(t.requesters.name));

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Solicitantes</h1>
      <p className="mb-6 text-sm text-slate-500">
        Cadastre quem pede encomendas (amigos, família). Depois é só escolher o solicitante ao cadastrar uma encomenda em qualquer viagem.
      </p>

      <ErrorBanner message={error} />

      <AddPanel title="Novo solicitante" defaultOpen={requesters.length === 0}>
        <form action={addRequesterAction} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome completo" className="sm:col-span-3">
            <input name="name" required className={inputCls} />
          </Field>
          <Field label="E-mail" className="sm:col-span-2">
            <input name="email" type="email" className={inputCls} />
          </Field>
          <Field label="Telefone / WhatsApp" className="sm:col-span-1">
            <input name="phone" inputMode="tel" placeholder="+55 11 99999-8888" className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar solicitante</button>
          </div>
        </form>
      </AddPanel>

      {requesters.length === 0 ? (
        <EmptyState>Nenhum solicitante cadastrado ainda.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {requesters.map((r) => (
            <li key={r.id}>
              <Card className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">{[r.email, r.phone].filter(Boolean).join(" · ") || "Sem contato cadastrado"}</p>
                </div>
                <Link href={`/requesters/${r.id}`} className="shrink-0 text-sm text-brand-700 hover:underline">
                  Editar
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
