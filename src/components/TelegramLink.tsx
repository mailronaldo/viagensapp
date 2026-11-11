"use client";

import { useActionState, useState } from "react";
import type { TelegramLinkState } from "@/app/actions/telegram";
import { ErrorBanner, btnGhost, btnPrimary } from "@/components/ui";

const initial: TelegramLinkState = {};

/** Gera um link de convite de uso único pra abrir o Telegram e vincular o chat (viajante ou dono da viagem). */
export function TelegramLinkForm({
  action,
  linked,
  hiddenFields,
}: {
  action: (prev: TelegramLinkState, formData: FormData) => Promise<TelegramLinkState>;
  linked: boolean;
  hiddenFields?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <ErrorBanner message={state.error} />
      {state.link && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="mb-2 font-medium">Link gerado — vale só uma vez, por 30 minutos.</p>
          <p className="mb-3 break-all">
            <code className="rounded bg-white px-2 py-0.5 font-mono">{state.link}</code>
          </p>
          <button type="button" onClick={copy} className={btnGhost}>
            {copied ? "Copiado ✓" : "Copiar link"}
          </button>
        </div>
      )}
      <form action={formAction}>
        {hiddenFields &&
          Object.entries(hiddenFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        <button disabled={pending} className={`${linked ? btnGhost : btnPrimary} disabled:opacity-60`}>
          {pending ? "Gerando…" : linked ? "Gerar novo link (substitui o vínculo atual)" : "Gerar link do Telegram"}
        </button>
      </form>
    </div>
  );
}
