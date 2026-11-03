import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { deleteExpenseAction, updateExpenseAction } from "@/app/actions/expenses";
import { ExpenseFields } from "@/components/TripFields";
import { Card, ErrorBanner, btnDanger, btnGhost, btnPrimary } from "@/components/ui";

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

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-3 text-lg font-medium">Editar lançamento</h2>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateExpenseAction.bind(null, trip.id, expense.id)} className="grid gap-3 sm:grid-cols-6">
          <ExpenseFields trip={trip} expense={expense} attachment={attachment} />
          <div className="flex gap-2 sm:col-span-6">
            <button className={btnPrimary}>Salvar alterações</button>
            <Link href={`/trips/${trip.id}/expenses`} className={btnGhost}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
      <form action={deleteExpenseAction.bind(null, trip.id, expense.id)} className="mt-4">
        <button className={btnDanger}>Excluir este lançamento</button>
      </form>
    </div>
  );
}
