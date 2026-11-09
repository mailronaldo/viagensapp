import Link from "next/link";
import { requireTripAccess } from "@/lib/access";
import { formatDateTime, formatMoney } from "@/lib/format";
import { listExpenseCategories, toNameMap } from "@/services/catalogs";
import { listClientCurrencyCodes, ensureTodayRates } from "@/services/currencies";
import { listTripTravelerOptions } from "@/services/trip-travelers";
import { listCostEntries, withConvertedAmounts, SOURCE_LABEL } from "@/services/cost-center";
import { VALUE_STATUS_LABEL, VALUE_STATUS_TONE } from "@/lib/labels";
import { Card, EmptyState, Tag, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Central de custos" };

export default async function CostCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string; traveler?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { category, traveler, from, to } = await searchParams;
  const { trip } = await requireTripAccess(id);

  const [entries, categories, travelerOptions, clientCurrencies] = await Promise.all([
    listCostEntries(trip.id),
    listExpenseCategories(),
    listTripTravelerOptions(trip),
    listClientCurrencyCodes(trip.ownerId),
  ]);
  await ensureTodayRates(clientCurrencies);
  const categoryName = toNameMap(categories);
  const converted = await withConvertedAmounts(entries, trip.baseCurrency);

  const filtered = converted.filter((e) => {
    if (category && e.category !== category) return false;
    if (traveler === "group" && e.travelerIds.length > 0) return false;
    if (traveler && traveler !== "group" && traveler !== "") {
      const wanted = traveler === "owner" ? null : traveler;
      if (!e.travelerIds.includes(wanted)) return false;
    }
    const day = e.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
  filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const aPagarTotal = filtered.filter((e) => e.status === "A_PAGAR").reduce((sum, e) => sum + (e.amountBase ?? 0), 0);
  const pagoTotal = filtered.filter((e) => e.status === "PAGO").reduce((sum, e) => sum + (e.amountBase ?? 0), 0);
  const unconvertedCount = filtered.filter((e) => e.amount && e.amountBase === null).length;

  return (
    <>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">A pagar</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">{formatMoney(aPagarTotal, trip.baseCurrency)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Pago</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">{formatMoney(pagoTotal, trip.baseCurrency)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Total ({trip.baseCurrency})</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(aPagarTotal + pagoTotal, trip.baseCurrency)}</p>
          {unconvertedCount > 0 && (
            <p className="mt-2 text-xs text-amber-700">{unconvertedCount} lançamento(s) sem cotação não entram no total.</p>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <form method="get" className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Categoria</label>
            <select name="category" defaultValue={category ?? ""} className={inputCls}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Viajante</label>
            <select name="traveler" defaultValue={traveler ?? ""} className={inputCls}>
              <option value="">Todos</option>
              <option value="group">Grupo</option>
              {travelerOptions.map((tr) => (
                <option key={tr.id ?? "owner"} value={tr.id ?? "owner"}>
                  {tr.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">De</label>
            <input type="date" name="from" defaultValue={from ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Até</label>
            <input type="date" name="to" defaultValue={to ?? ""} className={inputCls} />
          </div>
          <div className="sm:col-span-4">
            <button className={btnPrimary}>Filtrar</button>
            {(category || traveler || from || to) && (
              <Link href={`/trips/${trip.id}/costs`} className="ml-3 text-sm text-slate-500 hover:underline">
                Limpar filtros
              </Link>
            )}
          </div>
        </form>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState>Nenhum lançamento encontrado.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Cadastrado em</th>
                <th className="px-4 py-2 font-medium">Lançamento</th>
                <th className="px-4 py-2 font-medium">Categoria</th>
                <th className="px-4 py-2 font-medium">Viajante</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={`${e.source}-${e.id}`}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDateTime(e.createdAt)}</td>
                  <td className="px-4 py-2">
                    <Link href={e.editHref} className="text-brand-700 hover:underline">
                      {e.title}
                    </Link>
                    <span className="block text-xs text-slate-400">{SOURCE_LABEL[e.source]}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{e.category ? (categoryName[e.category] ?? e.category) : "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{e.travelerLabel}</td>
                  <td className="px-4 py-2">
                    <Tag tone={VALUE_STATUS_TONE[e.status]}>{VALUE_STATUS_LABEL[e.status]}</Tag>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                    {e.amount && e.currency ? formatMoney(e.amount, e.currency) : "—"}
                    {e.amountBase !== null && e.currency !== trip.baseCurrency && (
                      <span className="block text-xs text-slate-400">≈ {formatMoney(e.amountBase, trip.baseCurrency)}</span>
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
