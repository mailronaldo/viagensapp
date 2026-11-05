import "server-only";
import { Country, State, City } from "country-state-city";

export type GeoOption = { code: string; name: string };

/** Países, ordenados por nome. */
export function listCountries(): GeoOption[] {
  return Country.getAllCountries()
    .map((c) => ({ code: c.isoCode, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Estados/províncias de um país (lista vazia se o país não tiver essa divisão). */
export function listStates(countryCode: string): GeoOption[] {
  return State.getStatesOfCountry(countryCode)
    .map((s) => ({ code: s.isoCode, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Cidades de um estado, ou do país inteiro quando ele não tem estados cadastrados. */
export function listCities(countryCode: string, stateCode?: string | null): string[] {
  const rows = stateCode
    ? City.getCitiesOfState(countryCode, stateCode)
    : City.getCitiesOfCountry(countryCode) ?? [];
  return [...new Set(rows.map((c) => c.name))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return Country.getCountryByCode(code)?.name ?? null;
}

export function stateName(countryCode: string | null | undefined, stateCode: string | null | undefined): string | null {
  if (!countryCode || !stateCode) return null;
  return State.getStateByCodeAndCountry(stateCode, countryCode)?.name ?? null;
}
