"use client";

import { useActionState, useState } from "react";
import { generateTelegramLinkAction, type TelegramLinkState } from "@/app/actions/travelers";
import { ErrorBanner, btnGhost, btnPrimary } from "@/components/ui";

const initial: TelegramLinkState = {};

/** Gera um link de convite de uso único pro viajante abrir o Telegram e vincular o próprio chat. */
export function TelegramLinkForm({ travelerId, linked }: { travelerId: string; linked: boolean }) {
  const [state, formAction, pending] = useActionState(generateTelegramLinkAction, initial);
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
          <p className="mb-2 font-medium">Link gerado — vale só uma vez, por 30 minutos. Envie pro viajante.</p>
          <p className="mb-3 break-all">
            <code className="rounded bg-white px-2 py-0.5 font-mono">{state.link}</code>
          </p>
          <button type="button" onClick={copy} className={btnGhost}>
            {copied ? "Copiado ✓" : "Copiar link"}
          </button>
        </div>
      )}
      <form action={formAction}>
        <input type="hidden" name="travelerId" value={travelerId} />
        <button disabled={pending} className={`${linked ? btnGhost : btnPrimary} disabled:opacity-60`}>
          {pending ? "Gerando…" : linked ? "Gerar novo link (substitui o vínculo atual)" : "Gerar link do Telegram"}
        </button>
      </form>
    </div>
  );
}
