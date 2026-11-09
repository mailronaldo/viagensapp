"use client";

import { useState, type ReactNode } from "react";
import { Field, inputCls } from "@/components/ui";

const TRIP_TYPES = ["ONE_WAY", "ROUND_TRIP", "MULTI_LEG"] as const;
type TripType = (typeof TRIP_TYPES)[number];

/** Alterna os campos de trecho mostrados no cadastro do transporte conforme o tipo de viagem escolhido. */
export function TripTypeToggle({
  initialTripType,
  oneWay,
  roundTrip,
  multiLeg,
}: {
  initialTripType?: string;
  oneWay: ReactNode;
  roundTrip: ReactNode;
  multiLeg: ReactNode;
}) {
  const [tripType, setTripType] = useState<TripType>(
    initialTripType && (TRIP_TYPES as readonly string[]).includes(initialTripType) ? (initialTripType as TripType) : "ONE_WAY",
  );
  return (
    <>
      <Field label="Tipo de viagem" className="sm:col-span-2">
        <select name="tripType" value={tripType} onChange={(e) => setTripType(e.target.value as TripType)} className={inputCls}>
          <option value="ONE_WAY">Somente ida</option>
          <option value="ROUND_TRIP">Ida e volta</option>
          <option value="MULTI_LEG">Múltiplos trechos</option>
        </select>
      </Field>
      {tripType === "ONE_WAY" && oneWay}
      {tripType === "ROUND_TRIP" && roundTrip}
      {tripType === "MULTI_LEG" && multiLeg}
    </>
  );
}
