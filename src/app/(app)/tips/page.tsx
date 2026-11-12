import { requireClient } from "@/lib/auth";
import { getClientCities, listNeighborhoodsForCities } from "@/services/cities";
import { listTipCategories } from "@/services/catalogs";
import { listClientTips } from "@/services/tips";
import { addTipAction, deleteTipAction, updateTipAction } from "@/app/actions/tips";
import { TipFormFields } from "@/components/TipFormFields";
import { TipCard } from "@/components/TipCard";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, btnOutline, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Dicas" };

export default async function TipsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; cityId?: string; neighborhoodId?: string; categoryId?: string; q?: string }>;
}) {
  const user = await requireClient();
  const { error, cityId, neighborhoodId, categoryId, q } = await searchParams;

  const [cities, categories] = await Promise.all([getClientCities(user.id), listTipCategories()]);
  const neighborhoods = await listNeighborhoodsForCities(cities.map((c) => c.id));
  const tips = await listClientTips(user.id, { cityId, neighborhoodId, categoryId, nameQuery: q });

  const filterQuery = new URLSearchParams();
  if (cityId) filterQuery.set("cityId", cityId);
  if (neighborhoodId) filterQuery.set("neighborhoodId", neighborhoodId);
  if (categoryId) filterQuery.set("categoryId", categoryId);
  if (q) filterQuery.set("q", q);
  const hasFilter = filterQuery.size > 0;

  return (
    <>
      <p className="mb-4 text-sm text-slate-500">
        Repositório de lugares por cidade/bairro — usado também no card de Dicas de cada atividade.
      </p>

      <ErrorBanner message={error} />

      <Card className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-4">
          <Field label="Buscar por nome" className="sm:col-span-1">
            <input type="text" name="q" defaultValue={q ?? ""} placeholder="Nome do lugar" className={inputCls} />
          </Field>
          <Field label="Cidade" className="sm:col-span-1">
            <select name="cityId" defaultValue={cityId ?? ""} className={inputCls}>
              <option value="">Todas</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bairro/Região" className="sm:col-span-1">
            <select name="neighborhoodId" defaultValue={neighborhoodId ?? ""} className={inputCls}>
              <option value="">Todos</option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} — {n.cityName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoria" className="sm:col-span-1">
            <select name="categoryId" defaultValue={categoryId ?? ""} className={inputCls}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-4">
            <button className={btnPrimary}>Filtrar</button>
          </div>
        </form>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {tips.length} dica{tips.length === 1 ? "" : "s"} encontrada{tips.length === 1 ? "" : "s"}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/tools/tip-importer" className={btnOutline}>
            Importar dicas
          </a>
          {hasFilter && (
            <a href={`/api/tips/export?${filterQuery.toString()}`} className={btnOutline}>
              Exportar filtradas
            </a>
          )}
          <a href="/api/tips/export" className={btnOutline}>
            Exportar todas
          </a>
        </div>
      </div>

      <AddPanel title="Nova dica" defaultOpen={tips.length === 0}>
        <form action={addTipAction} className="grid gap-3 sm:grid-cols-6">
          <TipFormFields neighborhoods={neighborhoods} categories={categories} />
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar dica</button>
          </div>
        </form>
      </AddPanel>

      {tips.length === 0 ? (
        <EmptyState>Nenhuma dica encontrada.</EmptyState>
      ) : (
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {tips.map((tip) => (
            <li key={tip.id}>
              <TipCard
                tip={tip}
                neighborhoods={neighborhoods}
                categories={categories}
                updateAction={updateTipAction.bind(null, tip.id)}
                deleteAction={deleteTipAction.bind(null, tip.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
