import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import { createAndLinkCityAction, linkCityAction, unlinkCityAction } from "@/app/actions/cities";
import { listCountries } from "@/lib/geo";
import { CityGeoFields } from "@/components/CityGeoFields";
import { CountryFlag } from "@/components/CountryFlag";
import { AddPanel, EmptyState, ErrorBanner, btnPrimary } from "@/components/ui";

export const metadata = { title: "Cidades da viagem" };

export default async function TripCitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { trip, canWrite } = await requireTripAccess(id);

  const [linked, ownerCities] = await Promise.all([
    db
      .select({ city: t.cities })
      .from(t.tripCities)
      .innerJoin(t.cities, eq(t.cities.id, t.tripCities.cityId))
      .where(eq(t.tripCities.tripId, trip.id))
      .orderBy(asc(t.tripCities.position), asc(t.cities.name)),
    // Cidades do cliente dono da viagem: as candidatas a entrar no roteiro.
    db.select().from(t.cities).where(eq(t.cities.clientId, trip.ownerId)).orderBy(asc(t.cities.name)),
  ]);
  const linkedIds = new Set(linked.map((l) => l.city.id));
  const available = ownerCities.filter((c) => !linkedIds.has(c.id));
  const countries = listCountries();

  return (
    <>
      <p className="mb-4 text-sm text-slate-500">
        Cidades usadas no roteiro desta viagem. Cadastre e vincule aqui antes de montar os dias.
      </p>

      <ErrorBanner message={error} />

      {canWrite && (
        <>
          {available.length > 0 && (
            <AddPanel title="Vincular cidades já cadastradas" defaultOpen={linked.length === 0}>
              <form action={linkCityAction.bind(null, trip.id)} className="space-y-3">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {available.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-brand-600">
                        <input type="checkbox" name="cityIds" value={c.id} />
                        {c.countryCode && <CountryFlag code={c.countryCode} title={c.country ?? undefined} />}
                        <span className="min-w-0">
                          <span className="block truncate">{c.name}</span>
                          {c.country && <span className="block truncate text-xs text-slate-500">{c.country}</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button className={btnPrimary}>Vincular selecionadas</button>
              </form>
            </AddPanel>
          )}

          <AddPanel title="Cadastrar nova cidade e vincular" defaultOpen={ownerCities.length === 0}>
            <form action={createAndLinkCityAction.bind(null, trip.id)} className="grid gap-3 sm:grid-cols-6">
              <CityGeoFields countries={countries} />
              <div className="sm:col-span-6">
                <button className={btnPrimary}>Salvar e vincular</button>
              </div>
            </form>
          </AddPanel>
        </>
      )}

      {linked.length === 0 ? (
        <EmptyState>Nenhuma cidade vinculada ainda.</EmptyState>
      ) : (
        <div className="flex flex-wrap gap-2">
          {linked.map(({ city: c }) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-900"
            >
              {c.countryCode && <CountryFlag code={c.countryCode} title={c.country ?? undefined} />}
              {c.name}
              {c.country && <span className="text-brand-700/70">· {c.country}</span>}
              {canWrite && (
                <form action={unlinkCityAction.bind(null, trip.id, c.id)}>
                  <button aria-label={`Remover ${c.name}`} className="cursor-pointer text-brand-700 hover:text-rose-700">
                    ×
                  </button>
                </form>
              )}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
