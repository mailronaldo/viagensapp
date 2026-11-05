import Link from "next/link";
import { formatDate } from "@/lib/format";
import { Tag, type TagTone } from "@/components/ui";
import { CountryFlag } from "@/components/CountryFlag";

export function TripCard({
  href,
  title,
  destination,
  startDate,
  endDate,
  status,
  iconUrl,
  countryCodes,
}: {
  href: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status?: { label: string; tone: TagTone };
  /** Ícone enviado pelo cliente para esta viagem; sem ele, cai no ícone padrão (mapa). */
  iconUrl?: string | null;
  /** Países do roteiro, pra mostrar a bandeira alinhada à direita na linha do status. */
  countryCodes?: string[];
}) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-900/10"
    >
      <div
        className="relative flex h-24 items-center justify-center overflow-hidden bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900 text-3xl"
        aria-hidden
      >
        <div className="absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-white/10" />
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt=""
            className="relative size-14 rounded-xl object-cover shadow-sm transition-transform group-hover:scale-110"
          />
        ) : (
          <span className="relative drop-shadow-sm transition-transform group-hover:scale-110">🗺️</span>
        )}
      </div>
      <div className="p-4">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-slate-600">{destination}</p>
        <p className="mt-1 text-xs text-slate-500">
          {formatDate(startDate)} → {formatDate(endDate)}
        </p>
        {(status || (countryCodes && countryCodes.length > 0)) && (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            {status ? <Tag tone={status.tone}>{status.label}</Tag> : <span />}
            {countryCodes && countryCodes.length > 0 && (
              <span className="flex items-center gap-1">
                {countryCodes.map((code) => (
                  <CountryFlag key={code} code={code} className="h-3.5 w-[1.167em] rounded-[2px] object-cover" />
                ))}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
