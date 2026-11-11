import { requireClient } from "@/lib/auth";
import { getClientCities, listNeighborhoodsForCities } from "@/services/cities";
import { listTipCategories } from "@/services/catalogs";
import { listClientTips } from "@/services/tips";
import { addTipAction, deleteTipAction, updateTipAction } from "@/app/actions/tips";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { googleMapsSearchUrl } from "@/lib/maps";
import { AddPanel, Card, CategoryCheckboxes, EmptyState, ErrorBanner, Field, NeighborhoodSelect, Tag, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Dicas" };

function TipFormFields({
  neighborhoods,
  categories,
  tip,
}: {
  neighborhoods: { id: string; name: string; cityId: string; cityName: string }[];
  categories: { id: string; name: string }[];
  tip?: {
    name: string;
    description: string | null;
    neighborhoodId: string | null;
    categories?: { id: string; name: string }[];
  };
}) {
  return (
    <>
      <Field label="Nome" className="sm:col-span-4">
        <input name="name" required defaultValue={tip?.name} className={inputCls} />
      </Field>
      <Field label="Bairro/Região" className="sm:col-span-2">
        <NeighborhoodSelect neighborhoods={neighborhoods} defaultValue={tip?.neighborhoodId ?? ""} required />
      </Field>
      <Field label="Categorias" className="sm:col-span-6">
        <CategoryCheckboxes categories={categories} defaultSelected={tip?.categories?.map((c) => c.id)} />
      </Field>
      <Field label="Descrição" className="sm:col-span-6">
        <textarea name="description" rows={2} defaultValue={tip?.description ?? ""} className={inputCls} />
      </Field>
    </>
  );
}

export default async function TipsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; cityId?: string; neighborhoodId?: string; categoryId?: string }>;
}) {
  const user = await requireClient();
  const { error, cityId, neighborhoodId, categoryId } = await searchParams;

  const [cities, categories] = await Promise.all([getClientCities(user.id), listTipCategories()]);
  const neighborhoods = await listNeighborhoodsForCities(cities.map((c) => c.id));
  const tips = await listClientTips(user.id, { cityId, neighborhoodId, categoryId });

  return (
    <>
      <p className="mb-4 text-sm text-slate-500">
        Repositório de lugares por cidade/bairro — usado também no card de Dicas de cada atividade.
      </p>

      <ErrorBanner message={error} />

      <Card className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-3">
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
          <div className="sm:col-span-3">
            <button className={btnPrimary}>Filtrar</button>
          </div>
        </form>
      </Card>

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
        <ul className="space-y-2">
          {tips.map((tip) => (
            <li key={tip.id} className="rounded-lg border border-slate-200">
              <details className="group">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <a
                      href={googleMapsSearchUrl([tip.name, tip.neighborhoodName, tip.cityName])}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline"
                    >
                      {tip.name}
                    </a>
                    <p className="text-xs text-slate-500">
                      {[tip.cityName, tip.neighborhoodName].filter(Boolean).join(" · ") || "Sem cidade"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tip.categories.map((c) => (
                        <Tag key={c.id} tone="neutral">
                          {c.name}
                        </Tag>
                      ))}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-brand-700 group-open:hidden">editar</span>
                    <span className="hidden text-xs text-brand-700 group-open:inline">fechar</span>
                  </span>
                </summary>
                <div className="border-t border-slate-100 p-3">
                  <div className="mb-3 flex items-center justify-end">
                    <ConfirmDeleteButton
                      label="Excluir dica"
                      confirmTitle="Excluir esta dica?"
                      confirmDescription="Só é possível excluir se nenhuma atividade estiver usando essa dica."
                      deleteAction={deleteTipAction.bind(null, tip.id)}
                      size="sm"
                    />
                  </div>
                  <form action={updateTipAction.bind(null, tip.id)} className="grid gap-3 sm:grid-cols-6">
                    <TipFormFields neighborhoods={neighborhoods} categories={categories} tip={tip} />
                    <div className="sm:col-span-6">
                      <button className={btnPrimary}>Salvar dica</button>
                    </div>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
