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
  const originQuery = origin ? toQuery(origin) : "";

  if (waypoints && waypoints.length > 0) {
    // Formato de rota "por caminho" (sem `api=1`/`waypoints=`): o Maps segue
    // a ordem exata dos pontos passados, em vez de reotimizar a ordem das
    // paradas — o formato com `waypoints=` deixa o Maps escolher a ordem que
    // achar mais curta, o que bagunçava roteiros a pé já pensados em
    // sequência (ex.: Vessel → High Line → Chelsea → Little Island virava
    // um vai-e-volta). Origem vazia ("") vira "//" no caminho, que o Maps
    // entende como "minha localização" — mesmo efeito de omitir `origin` no
    // formato antigo.
    const legs = [originQuery, ...waypoints.map(toQuery), toQuery(destination)];
    const path = legs.map((p) => encodeURIComponent(p)).join("/");
    const query = travelmode ? `?travelmode=${travelmode}` : "";
    return `https://www.google.com/maps/dir/${path}${query}`;
  }

  const params = new URLSearchParams({ api: "1", destination: toQuery(destination) });
  if (originQuery) params.set("origin", originQuery);
  if (travelmode) params.set("travelmode", travelmode);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
