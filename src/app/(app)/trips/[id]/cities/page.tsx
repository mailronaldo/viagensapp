import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { addCityAction, deleteCityAction } from "@/app/actions/trips";
import { AddPanel, EmptyState, Field, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Cidades" };

export default async function TripCitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, canWrite } = await requireTripAccess(id);

  const cities = await db.select().from(t.cities).where(eq(t.cities.tripId, trip.id)).orderBy(asc(t.cities.position));

  return (
    <>
      <p className="mb-4 text-sm text-slate-500">
        Cidades usadas no roteiro desta viagem. Cadastre aqui antes de montar os dias.
      </p>

      {cities.length === 0 ? (
        <EmptyState>Nenhuma cidade cadastrada ainda.</EmptyState>
      ) : (
        <div className="mb-6 flex flex-wrap gap-2">
          {cities.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-900"
            >
              {c.name}
              {c.country && <span className="text-brand-700/70">· {c.country}</span>}
              {canWrite && (
                <form action={deleteCityAction.bind(null, trip.id, c.id)}>
                  <button aria-label={`Remover ${c.name}`} className="cursor-pointer text-brand-700 hover:text-rose-700">
                    ×
                  </button>
                </form>
              )}
            </span>
          ))}
        </div>
      )}

      {canWrite && (
        <AddPanel title="Adicionar cidade" defaultOpen={cities.length === 0}>
          <form action={addCityAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-3">
            <Field label="Cidade">
              <input name="name" required className={inputCls} />
            </Field>
            <Field label="País">
              <input name="country" className={inputCls} />
            </Field>
            <div className="sm:col-span-3">
              <button className={btnPrimary}>Salvar cidade</button>
            </div>
          </form>
        </AddPanel>
      )}
    </>
  );
}
