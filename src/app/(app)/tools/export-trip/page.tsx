import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { Card, Field, btnOutline, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Exportar viagem" };

export default async function ExportTripPage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  const user = await requireClient();
  const { tripId } = await searchParams;

  const rows = await db
    .select({ trip: t.trips })
    .from(t.tripMembers)
    .innerJoin(t.trips, eq(t.trips.id, t.tripMembers.tripId))
    .where(eq(t.tripMembers.userId, user.id))
    .orderBy(desc(t.trips.startDate));
  const trips = rows.map(({ trip }) => trip);
  const selectedTrip = tripId ? trips.find((tr) => tr.id === tripId) ?? null : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Exportar viagem</h1>
      <p className="mb-4 text-sm text-slate-500">
        Gere um PDF do roteiro (dia específico ou a viagem completa) pra guardar offline no celular ou imprimir.
        Opcionalmente, inclua no fim do PDF os anexos (vouchers, reservas, ingressos, documentos) do período.
      </p>

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

      {selectedTrip && (
        <Card>
          <form method="POST" action="/api/tools/export-trip" className="grid gap-4">
            <input type="hidden" name="tripId" value={selectedTrip.id} />

            <div>
              <p className="mb-2 text-sm font-medium">Período</p>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="scope" value="full" defaultChecked />
                  Viagem completa
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="scope" value="day" />
                  Dia específico
                </label>
                <input
                  type="date"
                  name="date"
                  min={selectedTrip.startDate}
                  max={selectedTrip.endDate}
                  defaultValue={selectedTrip.startDate}
                  className={inputCls}
                  style={{ maxWidth: 180 }}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="includeAttachments" />
              Incluir anexos (vouchers, reservas, ingressos, documentos)
            </label>

            <div>
              <button className={btnPrimary}>Gerar PDF</button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
