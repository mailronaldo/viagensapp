import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { deleteExpenseAction, updateExpenseAction } from "@/app/actions/expenses";
import { addPaymentAction } from "@/app/actions/payments";
import { listExpenseCategories } from "@/services/catalogs";
import { listClientCurrencyCodes } from "@/services/currencies";
import { listPayments } from "@/services/payments";
import { listTripTravelerOptions } from "@/services/trip-travelers";
import { ExpenseFields, PaymentFields, PaymentList } from "@/components/TripFields";
import { AddPanel, Card, ErrorBanner, btnDanger, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Editar lançamento" };

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; expenseId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, expenseId } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);
  if (!canWrite) redirect(`/trips/${id}/expenses`);

  const [expense] = await db
    .select()
    .from(t.expenses)
    .where(and(eq(t.expenses.id, expenseId), eq(t.expenses.tripId, trip.id)))
    .limit(1);
  if (!expense) notFound();

  const [doc] = expense.receiptDocumentId
    ? await db.select({ fileName: t.documents.fileName }).from(t.documents).where(eq(t.documents.id, expense.receiptDocumentId)).limit(1)
    : [];
  const attachment = doc ? { name: doc.fileName, href: `/api/files/${trip.id}/${expense.receiptDocumentId}` } : null;
  const [categories, currencies, payments, travelers] = await Promise.all([
    listExpenseCategories(),
    listClientCurrencyCodes(trip.ownerId),
    listPayments("EXPENSE", expense.id),
    listTripTravelerOptions(trip),
  ]);
  const travelerName = new Map(travelers.map((tr) => [tr.id ?? "owner", tr.name]));
  const back = `/trips/${trip.id}/expenses/${expense.id}`;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-3 text-lg font-medium">Editar lançamento</h2>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateExpenseAction.bind(null, trip.id, expense.id)} className="grid gap-3 sm:grid-cols-6">
          <ExpenseFields trip={trip} expense={expense} categories={categories} attachment={attachment} currencies={currencies} />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={`/trips/${trip.id}/expenses`} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        <AddPanel title={`Pagamentos${payments.length > 0 ? ` (${payments.length})` : ""}`} defaultOpen>
          <PaymentList payments={payments} travelerName={travelerName} />
          <p className="mb-2 text-sm font-medium">Lançar pagamento</p>
          <form action={addPaymentAction.bind(null, trip.id, "EXPENSE", expense.id, back)} className="grid gap-3 sm:grid-cols-6">
            <PaymentFields travelers={travelers} currency={expense.currency} />
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Lançar pagamento</button>
            </div>
          </form>
        </AddPanel>
      </div>

      <form action={deleteExpenseAction.bind(null, trip.id, expense.id)} className="mt-4">
        <button className={btnDanger}>Excluir este lançamento</button>
      </form>
    </div>
  );
}
