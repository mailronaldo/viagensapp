import { requireClient } from "@/lib/auth";
import { addCurrencyAction, deleteCurrencyAction } from "@/app/actions/currencies";
import { BRL, ensureTodayRates, getLatestRates, listClientCurrencies } from "@/services/currencies";
import { formatDate } from "@/lib/format";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, ErrorBanner, Field, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Moedas" };

export default async function CurrenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireClient();
  const { error } = await searchParams;

  const currencies = await listClientCurrencies(user.id);
  await ensureTodayRates(currencies.map((c) => c.code));
  const rates = await getLatestRates(currencies.map((c) => c.code));

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Moedas</h1>
      <p className="mb-6 text-sm text-slate-500">
        {BRL} é a moeda padrão do sistema. Cadastre aqui as demais moedas que você usa nas suas viagens — a cotação
        do dia é atualizada automaticamente.
      </p>

      <ErrorBanner message={error} />

      <AddPanel title="Nova moeda">
        <form action={addCurrencyAction} className="grid gap-3 sm:grid-cols-6">
          <Field label="Código (ISO, ex.: USD)" className="sm:col-span-2">
            <input name="code" required maxLength={3} placeholder="USD" className={`${inputCls} uppercase`} />
          </Field>
          <Field label="Nome (opcional)" className="sm:col-span-4">
            <input name="name" placeholder="Ex.: Dólar americano" className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar moeda</button>
          </div>
        </form>
      </AddPanel>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        <li>
          <Card className="flex items-center justify-between gap-3 !p-3">
            <div>
              <p className="font-medium">{BRL}</p>
              <p className="text-xs text-slate-500">Moeda padrão do sistema</p>
            </div>
          </Card>
        </li>
        {currencies.map((c) => {
          const rate = rates.get(c.code);
          return (
            <li key={c.id}>
              <Card className="flex items-center justify-between gap-3 !p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {c.code}
                    {c.name ? ` — ${c.name}` : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    {rate
                      ? `1 ${c.code} = ${Number(rate.rateToBrl).toFixed(4)} BRL (${formatDate(rate.asOfDate)})`
                      : "Cotação ainda não disponível"}
                  </p>
                </div>
                <ConfirmDeleteButton
                  label="Remover"
                  confirmTitle={`Remover ${c.code}?`}
                  confirmDescription="Só dá pra remover se essa moeda não estiver em uso em nenhuma viagem sua."
                  deleteAction={deleteCurrencyAction.bind(null, c.id)}
                />
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
