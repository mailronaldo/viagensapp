function placeQuery(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(", ");
}

/**
 * Monta um link de busca do Google Maps a partir do nome do lugar (+
 * cidade/bairro pra desambiguar). Evita pedir ao usuário pra achar e colar
 * a URL exata do local — o Maps já resolve pro resultado certo na busca.
 */
export function googleMapsSearchUrl(parts: (string | null | undefined)[]) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(parts))}`;
}

/**
 * Monta um link de rota do Google Maps. Sem API key nem geocoding aqui —
 * quem resolve nome de lugar e caminho é o próprio Maps ao abrir o link.
 * `origin` omitido faz o Maps usar a localização atual do dispositivo como
 * partida (ótimo durante a viagem, no celular). Cada ponto pode já vir
 * pronto (ex. "lat,lng") ou como partes de texto livre.
 */
export function googleMapsDirectionsUrl({
  origin,
  destination,
  waypoints,
  travelmode,
}: {
  origin?: (string | null | undefined)[] | string | null;
  destination: (string | null | undefined)[] | string;
  waypoints?: ((string | null | undefined)[] | string)[];
  travelmode?: "walking";
}) {
  const toQuery = (p: (string | null | undefined)[] | string) => (Array.isArray(p) ? placeQuery(p) : p);
  const params = new URLSearchParams({ api: "1", destination: toQuery(destination) });
  const originQuery = origin ? toQuery(origin) : "";
  if (originQuery) params.set("origin", originQuery);
  if (waypoints && waypoints.length > 0) params.set("waypoints", waypoints.map(toQuery).join("|"));
  if (travelmode) params.set("travelmode", travelmode);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
