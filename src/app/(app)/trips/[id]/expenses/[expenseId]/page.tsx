import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";
import { deleteExpenseAction, updateExpenseAction } from "@/app/actions/expenses";
import { addExpensePaymentAction } from "@/app/actions/expense-payments";
import { listExpenseCategories } from "@/services/catalogs";
import { listClientCurrencyCodes } from "@/services/currencies";
import { listExpensePayments } from "@/services/expense-payments";
import { listTripTravelerOptions } from "@/services/trip-travelers";
import { PAYMENT_FORM_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { ExpenseFields, ExpensePaymentFields } from "@/components/TripFields";
import { AddPanel, Card, EmptyState, ErrorBanner, btnDanger, btnGhost, btnPrimary } from "@/components/ui";

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
    listExpensePayments(expense.id),
    listTripTravelerOptions(trip),
  ]);
  const travelerName = new Map(travelers.map((tr) => [tr.id ?? "owner", tr.name]));

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
          {payments.length === 0 ? (
            <EmptyState>Nenhum pagamento lançado ainda.</EmptyState>
          ) : (
            <ul className="mb-4 space-y-2">
              {payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">
                      {formatDate(payment.paymentDate)} · {travelerName.get(payment.payerTravelerId ?? "owner") ?? "Viajante removido"}
                    </p>
                    <p className="font-medium tabular-nums">{formatMoney(payment.amount, payment.currency)}</p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {PAYMENT_METHOD_LABEL[payment.method]} · {PAYMENT_FORM_LABEL[payment.form]}
                    {payment.installments ? ` · ${payment.installments}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mb-2 text-sm font-medium">Lançar pagamento</p>
          <form action={addExpensePaymentAction.bind(null, trip.id, expense.id)} className="grid gap-3 sm:grid-cols-6">
            <ExpensePaymentFields travelers={travelers} expenseCurrency={expense.currency} />
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
