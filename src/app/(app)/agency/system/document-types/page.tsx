import { requireMaster } from "@/lib/auth";
import { listDocumentTypes } from "@/services/catalogs";
import { addDocumentTypeAction, deleteDocumentTypeAction } from "@/app/actions/catalogs";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Agência · Tipos de documento" };

export default async function DocumentTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireMaster();
  const { error } = await searchParams;
  const types = await listDocumentTypes();

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Tipos de documento</h1>
      <p className="mb-6 text-sm text-slate-500">
        Opções do campo &ldquo;Tipo&rdquo; ao anexar um documento, valendo para todos os clientes e viagens.
      </p>

      <ErrorBanner message={error} />

      <AddPanel title="Novo tipo de documento" defaultOpen={types.length === 0}>
        <form action={addDocumentTypeAction} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome" className="sm:col-span-4">
            <input name="name" required placeholder="Ex.: Cartão de vacina" className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar tipo</button>
          </div>
        </form>
      </AddPanel>

      {types.length === 0 ? (
        <EmptyState>Nenhum tipo de documento cadastrado ainda.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {types.map((dt) => (
            <li key={dt.id}>
              <Card className="flex items-center justify-between gap-3 !p-3">
                <p className="truncate font-medium">{dt.name}</p>
                <ConfirmDeleteButton
                  label="Excluir tipo de documento"
                  confirmTitle="Excluir este tipo de documento?"
                  confirmDescription="Só é possível excluir se nenhum documento estiver usando esse tipo."
                  deleteAction={deleteDocumentTypeAction.bind(null, dt.id)}
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
