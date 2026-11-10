/**
 * Monta um link de busca do Google Maps a partir do nome do lugar (+
 * cidade/bairro pra desambiguar). Evita pedir ao usuário pra achar e colar
 * a URL exata do local — o Maps já resolve pro resultado certo na busca.
 */
export function googleMapsSearchUrl(parts: (string | null | undefined)[]) {
  const query = parts.filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
