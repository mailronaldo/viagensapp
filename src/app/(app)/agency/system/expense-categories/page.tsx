import { requireMaster } from "@/lib/auth";
import { RESERVED_EXPENSE_CATEGORY_NAMES, listExpenseCategories } from "@/services/catalogs";
import { addExpenseCategoryAction, deleteExpenseCategoryAction } from "@/app/actions/catalogs";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, Tag, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Agência · Categorias de custo" };

export default async function ExpenseCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireMaster();
  const { error } = await searchParams;
  const categories = await listExpenseCategories();

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Categorias de custo</h1>
      <p className="mb-6 text-sm text-slate-500">
        Opções do campo &ldquo;Categoria&rdquo; ao lançar um custo, valendo para todos os clientes e viagens.
      </p>

      <ErrorBanner message={error} />

      <AddPanel title="Nova categoria de custo" defaultOpen={categories.length === 0}>
        <form action={addExpenseCategoryAction} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome" className="sm:col-span-4">
            <input name="name" required placeholder="Ex.: Vistos e taxas" className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar categoria</button>
          </div>
        </form>
      </AddPanel>

      {categories.length === 0 ? (
        <EmptyState>Nenhuma categoria de custo cadastrada ainda.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {categories.map((c) => {
            const reserved = RESERVED_EXPENSE_CATEGORY_NAMES.includes(c.name);
            return (
              <li key={c.id}>
                <Card className="flex items-center justify-between gap-3 !p-3">
                  <p className="truncate font-medium">{c.name}</p>
                  {reserved ? (
                    <Tag tone="neutral">Reservada pelo sistema</Tag>
                  ) : (
                    <ConfirmDeleteButton
                      label="Excluir categoria de custo"
                      confirmTitle="Excluir esta categoria de custo?"
                      confirmDescription="Só é possível excluir se nenhum custo estiver usando essa categoria."
                      deleteAction={deleteExpenseCategoryAction.bind(null, c.id)}
                      size="sm"
                    />
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
