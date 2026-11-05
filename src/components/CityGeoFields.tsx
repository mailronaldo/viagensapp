"use client";

import { useEffect, useState } from "react";
import { Field } from "@/components/ui";
import { SearchSelect } from "@/components/SearchSelect";
import type { GeoOption } from "@/lib/geo";

/** País → estado → cidade em cascata, com busca, pra evitar erro de digitação no cadastro de cidades. */
export function CityGeoFields({ countries }: { countries: GeoOption[] }) {
  const [countryCode, setCountryCode] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [cityName, setCityName] = useState("");
  const [states, setStates] = useState<GeoOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    if (!countryCode) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- início do fetch, não é estado derivado
    setLoadingStates(true);
    fetch(`/api/geo/states?country=${countryCode}`)
      .then((r) => r.json())
      .then((data: GeoOption[]) => {
        if (!cancelled) setStates(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingStates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  useEffect(() => {
    // Alguns países não têm estado cadastrado: aí busca as cidades do país inteiro.
    if (!countryCode || (states.length > 0 && !stateCode)) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- início do fetch, não é estado derivado
    setLoadingCities(true);
    const qs = new URLSearchParams({ country: countryCode, ...(stateCode ? { state: stateCode } : {}) });
    fetch(`/api/geo/cities?${qs}`)
      .then((r) => r.json())
      .then((data: string[]) => {
        if (!cancelled) setCities(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode, stateCode, states.length]);

  function handleCountryChange(code: string) {
    setCountryCode(code);
    setStateCode("");
    setCityName("");
    setStates([]);
    setCities([]);
  }

  function handleStateChange(code: string) {
    setStateCode(code);
    setCityName("");
    setCities([]);
  }

  return (
    <>
      <Field label="País" className="sm:col-span-2">
        <SearchSelect
          name="countryCode"
          required
          value={countryCode}
          onChange={handleCountryChange}
          options={countries.map((c) => ({ value: c.code, label: c.name }))}
          searchPlaceholder="Buscar país…"
        />
      </Field>
      <Field
        label="Estado / província"
        className="sm:col-span-2"
        hint={states.length === 0 && countryCode && !loadingStates ? "Este país não tem essa divisão." : undefined}
      >
        <SearchSelect
          name="stateCode"
          value={stateCode}
          onChange={handleStateChange}
          options={states.map((s) => ({ value: s.code, label: s.name }))}
          placeholder={loadingStates ? "Carregando…" : "Selecione…"}
          searchPlaceholder="Buscar estado…"
          disabled={!countryCode || loadingStates || states.length === 0}
        />
      </Field>
      <Field label="Cidade" className="sm:col-span-2">
        <SearchSelect
          name="name"
          required
          value={cityName}
          onChange={setCityName}
          options={cities.map((name) => ({ value: name, label: name }))}
          placeholder={!countryCode ? "Selecione o país primeiro" : loadingCities ? "Carregando…" : "Selecione…"}
          searchPlaceholder="Buscar cidade…"
          disabled={!countryCode || loadingCities || cities.length === 0}
        />
      </Field>
    </>
  );
}
