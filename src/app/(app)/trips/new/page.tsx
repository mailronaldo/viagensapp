import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createTripAction } from "@/app/actions/trips";
import { CURRENCIES, TIMEZONES } from "@/lib/labels";
import { getClientCities } from "@/services/cities";
import { Card, ErrorBanner, Field, btnGhost, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Nova viagem" };

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireClient();
  const { error } = await searchParams;
  const cities = await getClientCities(user.id);
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
          <Field label="Cidades da viagem" className="sm:col-span-2" hint="Selecione ao menos uma.">
            {cities.length === 0 ? (
              <p className="text-sm text-slate-500">
                Você ainda não tem cidades cadastradas.{" "}
                <Link href="/cities" target="_blank" className="text-brand-700 hover:underline">
                  Cadastre em outra aba
                </Link>{" "}
                e volte aqui pra selecionar.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {cities.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-brand-600">
                      <input type="checkbox" name="cityIds" value={c.id} />
                      <span className="min-w-0">
                        <span className="block truncate">{c.name}</span>
                        {c.country && <span className="block truncate text-xs text-slate-500">{c.country}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
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
