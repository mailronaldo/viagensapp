"use client";

import { useActionState } from "react";
import { travelerAccessAction } from "@/app/actions/travelers";
import type { CredentialsState } from "@/app/actions/agency";
import { CredentialsBox } from "@/components/CredentialsBox";
import { ErrorBanner, btnGhost, btnPrimary } from "@/components/ui";

const initial: CredentialsState = {};

/** Gera (ou redefine) o acesso do viajante e mostra a senha temporária uma única vez. */
export function TravelerAccessForm({
  travelerId,
  hasAccess,
  loginUrl,
}: {
  travelerId: string;
  hasAccess: boolean;
  loginUrl: string;
}) {
  const [state, formAction, pending] = useActionState(travelerAccessAction, initial);

  return (
    <div className="space-y-3">
      <ErrorBanner message={state.error} />
      {state.credentials && <CredentialsBox {...state.credentials} loginUrl={loginUrl} />}
      <form action={formAction}>
        <input type="hidden" name="travelerId" value={travelerId} />
        <button disabled={pending} className={`${hasAccess ? btnGhost : btnPrimary} disabled:opacity-60`}>
          {pending ? "Gerando…" : hasAccess ? "Gerar nova senha temporária" : "Gerar acesso"}
        </button>
      </form>
    </div>
  );
}
