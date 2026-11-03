import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { deleteTravelerAction, updateTravelerAction } from "@/app/actions/travelers";
import { Card, ErrorBanner, Field, btnDanger, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Editar viajante" };

export default async function EditTravelerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;
  const { error } = await searchParams;

  // Filtra pelo cliente logado: viajante de outro cliente "não existe".
  const [tr] = await db
    .select()
    .from(t.travelers)
    .where(and(eq(t.travelers.id, id), eq(t.travelers.clientId, user.id)))
    .limit(1);
  if (!tr) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/travelers" className="text-xs text-slate-500 hover:underline">
        ← Viajantes
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold">{tr.name}</h1>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateTravelerAction.bind(null, tr.id)} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome completo" className="sm:col-span-4">
            <input name="name" required defaultValue={tr.name} className={inputCls} />
          </Field>
          <Field label="Nascimento" className="sm:col-span-2">
            <input name="birthDate" type="date" defaultValue={tr.birthDate ?? ""} className={inputCls} />
          </Field>
          <Field label="E-mail" className="sm:col-span-3">
            <input name="email" type="email" defaultValue={tr.email ?? ""} className={inputCls} />
          </Field>
          <Field label="Telefone / WhatsApp" className="sm:col-span-3">
            <input name="phone" inputMode="tel" defaultValue={tr.phone ?? ""} className={inputCls} />
          </Field>
          <Field label="Documento (passaporte, RG ou CPF)" className="sm:col-span-6">
            <input name="documentNumber" defaultValue={tr.documentNumber ?? ""} className={inputCls} />
          </Field>
          <Field label="Observações" className="sm:col-span-6">
            <textarea name="notes" rows={3} defaultValue={tr.notes ?? ""} className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar</button>
          </div>
        </form>
      </Card>
      <form action={deleteTravelerAction.bind(null, tr.id)} className="mt-4">
        <button className={btnDanger}>Excluir este viajante</button>
      </form>
    </div>
  );
}
