import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { addTravelerAction } from "@/app/actions/travelers";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Viajantes" };

export default async function TravelersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireClient();
  const { error } = await searchParams;

  const travelers = await db
    .select()
    .from(t.travelers)
    .where(eq(t.travelers.clientId, user.id))
    .orderBy(asc(t.travelers.name));

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Viajantes</h1>
      <p className="mb-6 text-sm text-slate-500">
        Cadastre as pessoas que viajam com você. Depois é só incluí-las em cada viagem.
      </p>

      <ErrorBanner message={error} />

      <AddPanel title="Novo viajante" defaultOpen={travelers.length === 0}>
        <form action={addTravelerAction} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome completo" className="sm:col-span-4">
            <input name="name" required className={inputCls} />
          </Field>
          <Field label="Nascimento" className="sm:col-span-2">
            <input name="birthDate" type="date" className={inputCls} />
          </Field>
          <Field label="E-mail" className="sm:col-span-3">
            <input name="email" type="email" className={inputCls} />
          </Field>
          <Field label="Telefone / WhatsApp" className="sm:col-span-3">
            <input name="phone" inputMode="tel" placeholder="+55 11 99999-8888" className={inputCls} />
          </Field>
          <Field label="Documento (passaporte, RG ou CPF)" className="sm:col-span-6">
            <input name="documentNumber" className={inputCls} />
          </Field>
          <Field label="Observações" className="sm:col-span-6">
            <textarea name="notes" rows={2} className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar viajante</button>
          </div>
        </form>
      </AddPanel>

      {travelers.length === 0 ? (
        <EmptyState>Nenhum viajante cadastrado ainda.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {travelers.map((tr) => (
            <li key={tr.id}>
              <Card className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{tr.name}</p>
                  <p className="text-xs text-slate-500">
                    {[tr.email, tr.phone, tr.birthDate ? `nasc. ${formatDate(tr.birthDate)}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Sem contato cadastrado"}
                  </p>
                </div>
                <Link href={`/travelers/${tr.id}`} className="shrink-0 text-sm text-brand-700 hover:underline">
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
