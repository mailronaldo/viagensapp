import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { deleteRequesterAction, updateRequesterAction } from "@/app/actions/requesters";
import { Card, ErrorBanner, Field, btnDanger, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Editar solicitante" };

export default async function EditRequesterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;
  const { error } = await searchParams;

  const [r] = await db
    .select()
    .from(t.requesters)
    .where(and(eq(t.requesters.id, id), eq(t.requesters.clientId, user.id)))
    .limit(1);
  if (!r) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/requesters" className="text-xs text-slate-500 hover:underline">
        ← Solicitantes
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold">{r.name}</h1>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateRequesterAction.bind(null, r.id)} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome completo" className="sm:col-span-4">
            <input name="name" required defaultValue={r.name} className={inputCls} />
          </Field>
          <Field label="E-mail" className="sm:col-span-2">
            <input name="email" type="email" defaultValue={r.email ?? ""} className={inputCls} />
          </Field>
          <Field label="Telefone / WhatsApp" className="sm:col-span-6">
            <input name="phone" inputMode="tel" defaultValue={r.phone ?? ""} className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar</button>
          </div>
        </form>
      </Card>
      <form action={deleteRequesterAction.bind(null, r.id)} className="mt-4">
        <button className={btnDanger}>Excluir este solicitante</button>
      </form>
    </div>
  );
}
