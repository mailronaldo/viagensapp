import { requireMaster } from "@/lib/auth";
import { listActivityTypes } from "@/services/catalogs";
import { addActivityTypeAction, deleteActivityTypeAction } from "@/app/actions/catalogs";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Agência · Tipos de atividade" };

export default async function ActivityTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireMaster();
  const { error } = await searchParams;
  const types = await listActivityTypes();

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Tipos de atividade</h1>
      <p className="mb-6 text-sm text-slate-500">
        Opções do campo &ldquo;Tipo&rdquo; ao criar uma atividade do roteiro, valendo para todos os clientes e
        viagens. &ldquo;Hospedagem&rdquo; e &ldquo;Transporte&rdquo; são nomes reservados: esses dois têm cadastro
        próprio e entram na agenda automaticamente.
      </p>

      <ErrorBanner message={error} />

      <AddPanel title="Novo tipo de atividade" defaultOpen={types.length === 0}>
        <form action={addActivityTypeAction} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome" className="sm:col-span-4">
            <input name="name" required placeholder="Ex.: Compras" className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar tipo</button>
          </div>
        </form>
      </AddPanel>

      {types.length === 0 ? (
        <EmptyState>Nenhum tipo de atividade cadastrado ainda.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {types.map((at) => (
            <li key={at.id}>
              <Card className="flex items-center justify-between gap-3 !p-3">
                <p className="truncate font-medium">{at.name}</p>
                <ConfirmDeleteButton
                  label="Excluir tipo de atividade"
                  confirmTitle="Excluir este tipo de atividade?"
                  confirmDescription="Só é possível excluir se nenhuma atividade estiver usando esse tipo."
                  deleteAction={deleteActivityTypeAction.bind(null, at.id)}
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
