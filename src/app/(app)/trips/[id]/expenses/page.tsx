import { requireTripAccess } from "@/lib/access";
import { formatDate, formatMoney, todayIn } from "@/lib/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import { getExpenseSummary, listExpenses } from "@/services/expenses";
import Link from "next/link";
import { ExpenseFields } from "@/components/TripFields";
import { addExpenseAction, deleteExpenseAction } from "@/app/actions/expenses";
import {
  AddPanel,
  Card,
  EmptyState,
  ErrorBanner,
  btnDanger,
  btnPrimary,
} from "@/components/ui";

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);

  const [rows, summary] = await Promise.all([
    listExpenses(trip.id),
    getExpenseSummary(trip.id, trip.baseCurrency),
  ]);
  const maxCat = Math.max(1, ...summary.byCategory.map((c) => c.totalBase));

  return (
    <>
      <ErrorBanner message={error} />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">Total em {summary.baseCurrency}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatMoney(summary.totalBase, summary.baseCurrency)}
          </p>
          {summary.byCurrency.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
              {summary.byCurrency.map((c) => (
                <li key={c.currency} className="tabular-nums">
                  {formatMoney(c.total, c.currency)} lançados em {c.currency}
                </li>
              ))}
            </ul>
          )}
          {summary.unconvertedCount > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              {summary.unconvertedCount} lançamento(s) sem cotação não entram no total convertido.
            </p>
          )}
        </Card>
        <Card className="md:col-span-2">
          <h2 className="mb-3 text-sm font-medium">Por categoria</h2>
          {summary.byCategory.length === 0 ? (
            <p className="text-sm text-slate-500">Sem lançamentos ainda.</p>
          ) : (
            <ul className="space-y-2">
              {summary.byCategory.map((c) => (
                <li key={c.category}>
                  <div className="flex justify-between text-xs">
                    <span>
                      {EXPENSE_CATEGORY_LABEL[c.category as keyof typeof EXPENSE_CATEGORY_LABEL]}
                    </span>
                    <span className="tabular-nums text-slate-600">
                      {formatMoney(c.totalBase, summary.baseCurrency)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-brand-600"
                      style={{ width: `${(c.totalBase / maxCat) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {canWrite && (
        <AddPanel title="Novo lançamento" defaultOpen={rows.length === 0}>
          <form
            action={addExpenseAction.bind(null, trip.id)}
            className="grid gap-3 sm:grid-cols-6"
          >
            <ExpenseFields trip={trip} defaultDate={todayIn(trip.timezone)} />
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Salvar lançamento</button>
            </div>
          </form>
        </AddPanel>
      )}

      {rows.length === 0 ? (
        <EmptyState>Nenhum custo lançado ainda.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Descrição</th>
                <th className="px-4 py-2 font-medium">Categoria</th>
                <th className="px-4 py-2 text-right font-medium">Valor</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ expense: e, paidByName }) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                    {formatDate(e.date, { day: "2-digit", month: "short" })}
                  </td>
                  <td className="px-4 py-2">
                    {e.description}
                    <span className="block text-xs text-slate-400">
                      {[paidByName, e.paymentMethod, e.source === "whatsapp" ? "via WhatsApp" : null]
                        .filter(Boolean)
                        .join(" · ")}
                      {e.receiptDocumentId && (
                        <>
                          {" · "}
                          <a
                            href={`/api/files/${trip.id}/${e.receiptDocumentId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-700 hover:underline"
                          >
                            📎 recibo
                          </a>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {EXPENSE_CATEGORY_LABEL[e.category]}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                    {formatMoney(e.amount, e.currency)}
                    {e.currency !== trip.baseCurrency && e.exchangeRate && (
                      <span className="block text-xs text-slate-400">
                        ≈ {formatMoney(Number(e.amount) * Number(e.exchangeRate), trip.baseCurrency)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canWrite && (
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/trips/${trip.id}/expenses/${e.id}`} className="text-xs text-brand-700 hover:underline">
                          Editar
                        </Link>
                        <form action={deleteExpenseAction.bind(null, trip.id, e.id)}>
                          <button className={btnDanger}>Remover</button>
                        </form>
                      </div>
                    )}
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
