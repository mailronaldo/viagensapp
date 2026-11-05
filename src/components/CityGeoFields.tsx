"use client";

import { useEffect, useState } from "react";
import { Field, inputCls } from "@/components/ui";
import type { GeoOption } from "@/lib/geo";

/** País → estado → cidade em cascata, pra evitar erro de digitação no cadastro de cidades. */
export function CityGeoFields({ countries }: { countries: GeoOption[] }) {
  const [countryCode, setCountryCode] = useState("");
  const [stateCode, setStateCode] = useState("");
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

  function handleCountryChange(value: string) {
    setCountryCode(value);
    setStateCode("");
    setStates([]);
    setCities([]);
  }

  function handleStateChange(value: string) {
    setStateCode(value);
    setCities([]);
  }

  return (
    <>
      <Field label="País" className="sm:col-span-2">
        <select
          name="countryCode"
          required
          value={countryCode}
          onChange={(e) => handleCountryChange(e.target.value)}
          className={inputCls}
        >
          <option value="">Selecione…</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Estado / província"
        className="sm:col-span-2"
        hint={states.length === 0 && countryCode && !loadingStates ? "Este país não tem essa divisão." : undefined}
      >
        <select
          name="stateCode"
          value={stateCode}
          onChange={(e) => handleStateChange(e.target.value)}
          disabled={!countryCode || loadingStates || states.length === 0}
          className={inputCls}
        >
          <option value="">{loadingStates ? "Carregando…" : "Selecione…"}</option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cidade" className="sm:col-span-2">
        <select name="name" required disabled={!countryCode || loadingCities || cities.length === 0} className={inputCls}>
          <option value="">
            {!countryCode ? "Selecione o país primeiro" : loadingCities ? "Carregando…" : "Selecione…"}
          </option>
          {cities.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
