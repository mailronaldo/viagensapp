import { requireMaster } from "@/lib/auth";
import { listReservationMethods } from "@/services/catalogs";
import { addReservationMethodAction, deleteReservationMethodAction } from "@/app/actions/catalogs";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AddPanel, Card, EmptyState, ErrorBanner, Field, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Agência · Métodos de reserva" };

export default async function ReservationMethodsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireMaster();
  const { error } = await searchParams;
  const methods = await listReservationMethods();

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Métodos de reserva</h1>
      <p className="mb-6 text-sm text-slate-500">
        Opções do campo &ldquo;Método de reserva&rdquo; ao cadastrar uma hospedagem, valendo para todos os clientes
        e viagens.
      </p>

      <ErrorBanner message={error} />

      <AddPanel title="Novo método de reserva" defaultOpen={methods.length === 0}>
        <form action={addReservationMethodAction} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome" className="sm:col-span-4">
            <input name="name" required placeholder="Ex.: Decolar" className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar método</button>
          </div>
        </form>
      </AddPanel>

      {methods.length === 0 ? (
        <EmptyState>Nenhum método de reserva cadastrado ainda.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {methods.map((rm) => (
            <li key={rm.id}>
              <Card className="flex items-center justify-between gap-3 !p-3">
                <p className="truncate font-medium">{rm.name}</p>
                <ConfirmDeleteButton
                  label="Excluir método de reserva"
                  confirmTitle="Excluir este método de reserva?"
                  confirmDescription="Só é possível excluir se nenhuma hospedagem estiver usando esse método."
                  deleteAction={deleteReservationMethodAction.bind(null, rm.id)}
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
