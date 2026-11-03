import { asc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { formatDateTime, formatMoney } from "@/lib/format";
import { BOOKING_TYPE_LABEL } from "@/lib/labels";
import Link from "next/link";
import { BookingFields } from "@/components/TripFields";
import { addBookingAction, deleteBookingAction } from "@/app/actions/bookings";
import {
  AddPanel,
  Card,
  EmptyState,
  ErrorBanner,
  btnDanger,
  btnPrimary,
} from "@/components/ui";

const ICON: Record<string, string> = {
  FLIGHT: "✈",
  HOTEL: "🏨",
  CAR_RENTAL: "🚗",
  TRANSFER: "🚐",
  TRAIN: "🚆",
  OTHER: "📌",
};

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);

  const rows = await db
    .select({ booking: t.bookings, fileName: t.documents.fileName })
    .from(t.bookings)
    .leftJoin(t.documents, eq(t.documents.id, t.bookings.documentId))
    .where(eq(t.bookings.tripId, trip.id))
    .orderBy(sql`${t.bookings.startAt} asc nulls last`, asc(t.bookings.title));

  return (
    <>
      <ErrorBanner message={error} />

      {canWrite && (
        <AddPanel title="Novo transporte" defaultOpen={rows.length === 0}>
          <form
            action={addBookingAction.bind(null, trip.id)}
            className="grid gap-3 sm:grid-cols-6"
          >
            <BookingFields trip={trip} />
            <div className="sm:col-span-6">
              <button className={btnPrimary}>Salvar transporte</button>
            </div>
          </form>
        </AddPanel>
      )}

      {rows.length === 0 ? (
        <EmptyState>Nenhum transporte cadastrado ainda.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ booking: b, fileName }) => (
            <li key={b.id}>
              <Card className="flex gap-4">
                <span className="text-2xl" aria-hidden>
                  {ICON[b.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h3 className="font-medium">{b.title}</h3>
                    <span className="text-xs text-slate-500">{BOOKING_TYPE_LABEL[b.type]}</span>
                    {b.provider && <span className="text-xs text-slate-400">· {b.provider}</span>}
                  </div>
                  <p className="text-sm text-slate-600">
                    {b.startAt ? formatDateTime(b.startAt) : "Sem data"}
                    {b.endAt ? ` → ${formatDateTime(b.endAt)}` : ""}
                  </p>
                  {(b.origin || b.destination) && (
                    <p className="text-sm text-slate-600">
                      {b.origin} → {b.destination}
                    </p>
                  )}
                  {b.address && <p className="text-sm text-slate-500">{b.address}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    {b.confirmationCode && (
                      <span className="mr-3">
                        Confirmação: <span className="font-mono">{b.confirmationCode}</span>
                      </span>
                    )}
                    {b.totalPrice && b.currency && (
                      <span>{formatMoney(b.totalPrice, b.currency)}</span>
                    )}
                  </p>
                  {b.details && <p className="mt-1 text-xs text-slate-500">{b.details}</p>}
                  {b.documentId && (
                    <a
                      href={`/api/files/${trip.id}/${b.documentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-brand-700 hover:underline"
                    >
                      📎 {fileName ?? "Voucher"}
                    </a>
                  )}
                </div>
                {canWrite && (
                  <div className="flex shrink-0 items-start gap-3">
                    <Link href={`/trips/${trip.id}/transports/${b.id}`} className="text-xs text-brand-700 hover:underline">
                      Editar
                    </Link>
                    <form action={deleteBookingAction.bind(null, trip.id, b.id)}>
                      <button className={btnDanger}>Remover</button>
                    </form>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
