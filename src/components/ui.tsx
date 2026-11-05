import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-xl border border-input bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-ring/15";

export const btnPrimary =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-brand-600 to-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-brand-900/20 transition hover:shadow-md hover:shadow-brand-900/25 hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-brand-600/30 active:brightness-95";

export const btnOutline =
  "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border border-brand-200 bg-white px-3.5 py-2 text-sm font-medium text-brand-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50";

export const btnGhost =
  "inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50";

export const btnDanger =
  "cursor-pointer text-xs font-medium text-rose-600 transition hover:text-rose-700 hover:underline";

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border/70 bg-card p-5 shadow-sm shadow-slate-200/50 ${className}`}>
      {children}
    </div>
  );
}

const TAG_TONE = {
  ok: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15",
  info: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600/15",
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10",
};
export type TagTone = keyof typeof TAG_TONE;

/** Classes da etiqueta de status; use direto quando a etiqueta for um link. */
export function tagCls(tone: TagTone) {
  return `inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium first-letter:uppercase ${TAG_TONE[tone]}`;
}

export function Tag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return <span className={tagCls(tone)}>{children}</span>;
}

/** Faixa de abertura da página, emendada no cabeçalho. */
export function Hero({ children }: { children: ReactNode }) {
  return <div className="hero-bleed mb-6 pb-6 pt-5 text-white">{children}</div>;
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm"
    >
      {message}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

/** Formulário recolhível: abre ao clicar no botão, sem JavaScript no cliente. */
export function AddPanel({
  title,
  children,
  defaultOpen = false,
  headerExtra,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Ex.: um botão de excluir — fica entre o título e "abrir/fechar", sem acionar o toggle do painel. */
  headerExtra?: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group relative mb-6 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm shadow-slate-200/50"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3.5 text-sm font-medium text-brand-800 transition hover:bg-brand-50/60">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-transform group-open:rotate-45"
          >
            +
          </span>
          {title}
        </span>
        <span className={`flex shrink-0 items-center gap-3 ${headerExtra ? "pe-9" : ""}`}>
          <span className="text-xs text-slate-400 group-open:hidden">abrir</span>
          <span className="hidden text-xs text-slate-400 group-open:inline">fechar</span>
        </span>
      </summary>
      {/* Fora do <summary> de propósito: clicar aqui não pode abrir/fechar o painel. */}
      {headerExtra && <div className="absolute right-4 top-2.5">{headerExtra}</div>}
      <div className="border-t border-slate-100 p-5">{children}</div>
    </details>
  );
}
