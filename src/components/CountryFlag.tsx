/**
 * Bandeira como imagem (SVG estático em /public/flags), não emoji: emoji de
 * bandeira não renderiza em todo sistema — no Windows, por exemplo, vira texto
 * ("US", "CA") em vez do ícone.
 */
export function CountryFlag({ code, title, className }: { code: string; title?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeno, não precisa de next/image
    <img
      src={`/flags/4x3/${code.toLowerCase()}.svg`}
      alt={title ?? code}
      title={title ?? code}
      className={className ?? "inline-block h-4 w-[1.333em] rounded-[2px] object-cover align-middle"}
    />
  );
}
