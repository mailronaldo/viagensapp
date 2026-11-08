import { asc, desc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cloneItemAction } from "@/app/actions/cloner";
import { Card, EmptyState, ErrorBanner, Field, btnOutline, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Clonador de atividades" };

export default async function ClonerPage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string; error?: string }>;
}) {
  const user = await requireClient();
  const { tripId, error } = await searchParams;

  const rows = await db
    .select({ trip: t.trips, role: t.tripMembers.role })
    .from(t.tripMembers)
    .innerJoin(t.trips, eq(t.trips.id, t.tripMembers.tripId))
    .where(eq(t.tripMembers.userId, user.id))
    .orderBy(desc(t.trips.startDate));
  const trips = rows.filter(({ role }) => role !== "VIEWER").map(({ trip }) => trip);
  const selectedTrip = tripId ? trips.find((tr) => tr.id === tripId) ?? null : null;

  const items = selectedTrip
    ? await db
        .select({ id: t.itineraryItems.id, date: t.itineraryItems.date, startTime: t.itineraryItems.startTime, title: t.itineraryItems.title })
        .from(t.itineraryItems)
        .where(eq(t.itineraryItems.tripId, selectedTrip.id))
        .orderBy(asc(t.itineraryItems.date), sql`${t.itineraryItems.startTime} asc nulls last`)
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Clonador de atividades</h1>
      <p className="mb-4 text-sm text-slate-500">
        Pegue uma atividade já cadastrada (com tips, pontos de interesse etc.) e crie uma cópia dela em outra
        data/horário da mesma viagem.
      </p>
      <ErrorBanner message={error} />

      <Card className="mb-4">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <Field label="Viagem" className="min-w-56 flex-1">
            <select name="tripId" defaultValue={tripId ?? ""} className={inputCls}>
              <option value="">Selecione…</option>
              {trips.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.title}
                </option>
              ))}
            </select>
          </Field>
          <button className={btnOutline}>Selecionar</button>
        </form>
      </Card>

      {selectedTrip &&
        (items.length === 0 ? (
          <EmptyState>Esta viagem ainda não tem atividades cadastradas no roteiro.</EmptyState>
        ) : (
          <Card>
            <form action={cloneItemAction.bind(null, selectedTrip.id)} className="grid gap-3 sm:grid-cols-2">
              <Field label="Atividade original" className="sm:col-span-2">
                <select name="itemId" required className={inputCls}>
                  <option value="">Selecione…</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {formatDate(it.date)} {it.startTime ?? ""} — {it.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nova data">
                <input
                  name="targetDate"
                  type="date"
                  required
                  min={selectedTrip.startDate}
                  max={selectedTrip.endDate}
                  className={inputCls}
                />
              </Field>
              <Field label="Novo horário" hint="Deixe em branco pra manter o mesmo horário da original.">
                <input name="targetTime" type="time" className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <button className={btnPrimary}>Clonar atividade</button>
              </div>
            </form>
          </Card>
        ))}
    </div>
  );
}
