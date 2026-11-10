import { X } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireTripAccess } from "@/lib/access";
import {
  addNeighborhoodAction,
  createAndLinkCityAction,
  deleteCityAction,
  deleteNeighborhoodAction,
  linkCityAction,
  unlinkCityAction,
} from "@/app/actions/cities";
import { listCityNeighborhoods } from "@/services/cities";
import { listCountries } from "@/lib/geo";
import { CityGeoFields } from "@/components/CityGeoFields";
import { CountryFlag } from "@/components/CountryFlag";
import { AddPanel, Card, EmptyState, ErrorBanner, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Cidades da viagem" };

export default async function TripCitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; cityId?: string }>;
}) {
  const { id } = await params;
  const { error, cityId } = await searchParams;
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

  const selectedCityId = cityId && linkedIds.has(cityId) ? cityId : linked[0]?.city.id;
  const neighborhoods = selectedCityId ? await listCityNeighborhoods(selectedCityId) : [];
  const backWithCity = selectedCityId ? `/trips/${trip.id}/cities?cityId=${selectedCityId}` : `/trips/${trip.id}/cities`;

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
                    <li
                      key={c.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-brand-600"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                        <input type="checkbox" name="cityIds" value={c.id} />
                        {c.countryCode && <CountryFlag code={c.countryCode} title={c.country ?? undefined} />}
                        <span className="min-w-0">
                          <span className="block truncate">{c.name}</span>
                          {c.country && <span className="block truncate text-xs text-slate-500">{c.country}</span>}
                        </span>
                      </label>
                      <button
                        type="submit"
                        formAction={deleteCityAction.bind(null, `/trips/${trip.id}/cities`, c.id)}
                        aria-label={`Excluir ${c.name} do catálogo`}
                        title="Excluir do catálogo"
                        className="shrink-0 cursor-pointer text-slate-400 hover:text-rose-700"
                      >
                        ×
                      </button>
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

      {linked.length > 0 && selectedCityId && (
        <div className="mt-6">
          <Card>
            <h3 className="mb-2 font-medium">Bairros / Regiões</h3>
            <p className="mb-3 text-xs text-slate-500">
              Cadastrados por cidade — reaproveitados em qualquer viagem que use a mesma cidade (atividades, transportes e dicas).
            </p>
            <form method="get" className="mb-3 flex gap-2">
              <select name="cityId" defaultValue={selectedCityId} className={`${inputCls} max-w-xs`}>
                {linked.map(({ city: c }) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button className={btnPrimary}>Ver</button>
            </form>
            {neighborhoods.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-1.5">
                {neighborhoods.map((n) => (
                  <li key={n.id}>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 ps-3 pe-1.5 text-xs text-brand-900">
                      {n.name}
                      {canWrite && (
                        <form action={deleteNeighborhoodAction.bind(null, backWithCity, n.id)}>
                          <button aria-label={`Remover ${n.name}`} className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-700 hover:bg-brand-200 hover:text-rose-700">
                            <X className="size-3" />
                          </button>
                        </form>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <form action={addNeighborhoodAction.bind(null, backWithCity, selectedCityId)} className="flex gap-2">
                <input name="name" placeholder="Ex.: Alfama" className={`${inputCls} text-sm`} />
                <button className={`${btnPrimary} shrink-0 px-3`}>+</button>
              </form>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
