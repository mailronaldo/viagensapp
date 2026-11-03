import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createTripAction } from "@/app/actions/trips";
import { CURRENCIES, TIMEZONES } from "@/lib/labels";
import { Card, ErrorBanner, Field, btnGhost, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Nova viagem" };

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireClient();
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Nova viagem</h1>
      <Card>
        <ErrorBanner message={error} />
        <form action={createTripAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da viagem" className="sm:col-span-2">
            <input name="title" required placeholder="Ex.: Férias em Portugal" className={inputCls} />
          </Field>
          <Field label="Destino" className="sm:col-span-2">
            <input name="destination" required placeholder="Ex.: Lisboa e Porto, Portugal" className={inputCls} />
          </Field>
          <Field label="Ida">
            <input name="startDate" type="date" required className={inputCls} />
          </Field>
          <Field label="Volta">
            <input name="endDate" type="date" required className={inputCls} />
          </Field>
          <Field label="Fuso horário do destino" hint="Define o que é “hoje” na agenda.">
            <select name="timezone" defaultValue="America/Sao_Paulo" className={inputCls}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Moeda base dos custos" hint="Os totais são somados nesta moeda.">
            <select name="baseCurrency" defaultValue="BRL" className={inputCls}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <textarea name="notes" rows={3} className={inputCls} />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <button className={btnPrimary}>Criar viagem</button>
            <Link href="/" className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
