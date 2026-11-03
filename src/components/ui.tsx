import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";

export const btnPrimary =
  "inline-flex cursor-pointer items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-600/40";

export const btnOutline =
  "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border border-brand-700 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50";

export const btnGhost =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50";

export const btnDanger =
  "cursor-pointer text-xs text-rose-600 hover:text-rose-800 hover:underline";

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
    <div className={`rounded-lg border border-slate-200 bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

const TAG_TONE = {
  ok: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-800",
  info: "bg-brand-50 text-brand-900",
  neutral: "bg-slate-100 text-slate-600",
};
export type TagTone = keyof typeof TAG_TONE;

/** Classes da etiqueta de status; use direto quando a etiqueta for um link. */
export function tagCls(tone: TagTone) {
  return `inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium first-letter:uppercase ${TAG_TONE[tone]}`;
}

export function Tag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return <span className={tagCls(tone)}>{children}</span>;
}

/** Faixa de abertura da página, emendada no cabeçalho. */
export function Hero({ children }: { children: ReactNode }) {
  return <div className="hero-bleed -mt-6 mb-6 pb-6 pt-3 text-white">{children}</div>;
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      {message}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

/** Formulário recolhível: abre ao clicar no botão, sem JavaScript no cliente. */
export function AddPanel({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group mb-6 rounded-lg border border-slate-200 bg-white"
    >
      <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-sm font-medium text-brand-800">
        <span>+ {title}</span>
        <span className="text-xs text-slate-400 group-open:hidden">abrir</span>
        <span className="hidden text-xs text-slate-400 group-open:inline">fechar</span>
      </summary>
      <div className="border-t border-slate-100 p-5">{children}</div>
    </details>
  );
}
