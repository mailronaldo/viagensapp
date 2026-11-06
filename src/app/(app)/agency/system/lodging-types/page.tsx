import { requireMaster } from "@/lib/auth";
import { listLodgingTypes } from "@/services/catalogs";
import { addLodgingTypeAction, deleteLodgingTypeAction } from "@/app/actions/catalogs";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Agência · Tipos de hospedagem" };

export default async function LodgingTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireMaster();
  const { error } = await searchParams;
  const types = await listLodgingTypes();

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Tipos de hospedagem</h1>
      <p className="mb-6 text-sm text-slate-500">
        Opções do campo &ldquo;Tipo&rdquo; ao cadastrar uma hospedagem, valendo para todos os clientes e viagens.
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
        <ul className="grid gap-3 sm:grid-cols-2">
          {types.map((lt) => (
            <li key={lt.id}>
              <Card className="flex items-center justify-between gap-3 !p-3">
                <p className="truncate font-medium">{lt.name}</p>
                <ConfirmDeleteButton
                  label="Excluir tipo de hospedagem"
                  confirmTitle="Excluir este tipo de hospedagem?"
                  confirmDescription="Só é possível excluir se nenhuma hospedagem estiver usando esse tipo."
                  deleteAction={deleteLodgingTypeAction.bind(null, lt.id)}
                  size="sm"
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
