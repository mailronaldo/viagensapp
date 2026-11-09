import { requireMaster } from "@/lib/auth";
import { listAllLodgingTypeSubcategories, listLodgingTypes } from "@/services/catalogs";
import {
  addLodgingTypeAction,
  addLodgingTypeSubcategoryAction,
  deleteLodgingTypeAction,
  deleteLodgingTypeSubcategoryAction,
} from "@/app/actions/catalogs";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, Tag, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Agência · Tipos de hospedagem" };

export default async function LodgingTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireMaster();
  const { error } = await searchParams;
  const [types, subcategories] = await Promise.all([listLodgingTypes(), listAllLodgingTypeSubcategories()]);
  const subcategoriesByType = new Map<string, typeof subcategories>();
  for (const sc of subcategories) {
    const list = subcategoriesByType.get(sc.lodgingTypeId) ?? [];
    list.push(sc);
    subcategoriesByType.set(sc.lodgingTypeId, list);
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Tipos de hospedagem</h1>
      <p className="mb-6 text-sm text-slate-500">
        Opções do campo &ldquo;Tipo&rdquo; ao cadastrar uma hospedagem, valendo para todos os clientes e viagens. Cada
        tipo pode ter subcategorias (ex.: Hotel → Standard, Suíte), usadas no tipo do voucher de hospedagem.
      </p>

      <ErrorBanner message={error} />

      <AddPanel title="Novo tipo de hospedagem" defaultOpen={types.length === 0}>
        <form action={addLodgingTypeAction} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome" className="sm:col-span-4">
            <input name="name" required placeholder="Ex.: Pousada" className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar tipo</button>
          </div>
        </form>
      </AddPanel>

      {types.length === 0 ? (
        <EmptyState>Nenhum tipo de hospedagem cadastrado ainda.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {types.map((lt) => {
            const typeSubcategories = subcategoriesByType.get(lt.id) ?? [];
            return (
              <li key={lt.id}>
                <Card className="!p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium">{lt.name}</p>
                    <ConfirmDeleteButton
                      label="Excluir tipo de hospedagem"
                      confirmTitle="Excluir este tipo de hospedagem?"
                      confirmDescription="Só é possível excluir se nenhuma hospedagem estiver usando esse tipo."
                      deleteAction={deleteLodgingTypeAction.bind(null, lt.id)}
                      size="sm"
                    />
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="mb-2 text-xs font-medium text-slate-500">Subcategorias</p>
                    {typeSubcategories.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {typeSubcategories.map((sc) => (
                          <span key={sc.id} className="flex items-center gap-1.5">
                            <Tag tone="neutral">{sc.name}</Tag>
                            <ConfirmDeleteButton
                              label={`Excluir subcategoria ${sc.name}`}
                              confirmTitle="Excluir esta subcategoria?"
                              confirmDescription="Só é possível excluir se nenhum voucher de hospedagem estiver usando essa subcategoria."
                              deleteAction={deleteLodgingTypeSubcategoryAction.bind(null, sc.id)}
                              size="sm"
                            />
                          </span>
                        ))}
                      </div>
                    )}
                    <form action={addLodgingTypeSubcategoryAction.bind(null, lt.id)} className="flex items-end gap-2">
                      <input name="name" required placeholder="Ex.: Suíte" className={`${inputCls} max-w-xs`} />
                      <button className={btnPrimary}>Adicionar</button>
                    </form>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
