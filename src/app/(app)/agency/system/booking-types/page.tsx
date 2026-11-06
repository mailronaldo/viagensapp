import { requireMaster } from "@/lib/auth";
import { listBookingTypes } from "@/services/catalogs";
import { addBookingTypeAction, deleteBookingTypeAction } from "@/app/actions/catalogs";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Agência · Tipos de transporte" };

export default async function BookingTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireMaster();
  const { error } = await searchParams;
  const types = await listBookingTypes();

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Tipos de transporte</h1>
      <p className="mb-6 text-sm text-slate-500">
        Opções do campo &ldquo;Tipo&rdquo; ao cadastrar um transporte, valendo para todos os clientes e viagens.
      </p>

      <ErrorBanner message={error} />

      <AddPanel title="Novo tipo de transporte" defaultOpen={types.length === 0}>
        <form action={addBookingTypeAction} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome" className="sm:col-span-4">
            <input name="name" required placeholder="Ex.: Barco" className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar tipo</button>
          </div>
        </form>
      </AddPanel>

      {types.length === 0 ? (
        <EmptyState>Nenhum tipo de transporte cadastrado ainda.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {types.map((bt) => (
            <li key={bt.id}>
              <Card className="flex items-center justify-between gap-3 !p-3">
                <p className="truncate font-medium">{bt.name}</p>
                <ConfirmDeleteButton
                  label="Excluir tipo de transporte"
                  confirmTitle="Excluir este tipo de transporte?"
                  confirmDescription="Só é possível excluir se nenhum transporte estiver usando esse tipo."
                  deleteAction={deleteBookingTypeAction.bind(null, bt.id)}
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
