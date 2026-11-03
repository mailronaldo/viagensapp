"use client";

import { useActionState } from "react";
import {
  createClientAction,
  resetClientPasswordAction,
  type CredentialsState,
} from "@/app/actions/agency";
import { CredentialsBox } from "@/components/CredentialsBox";
import { ErrorBanner, Field, btnGhost, btnPrimary, inputCls } from "@/components/ui";

const initial: CredentialsState = {};

export function NewClientForm({ loginUrl }: { loginUrl: string }) {
  const [state, formAction, pending] = useActionState(createClientAction, initial);

  if (state.credentials) {
    return (
      <div className="space-y-4">
        <CredentialsBox {...state.credentials} loginUrl={loginUrl} />
        {/* <a> de propósito: recarrega a página e descarta a senha temporária da tela. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/agency/clients/new" className={btnGhost}>
          Cadastrar outro cliente
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <ErrorBanner message={state.error} />
      <Field label="Nome do cliente">
        <input name="name" required className={inputCls} />
      </Field>
      <Field label="E-mail (será o login)">
        <input name="email" type="email" required className={inputCls} />
      </Field>
      <p className="text-xs text-slate-500">
        O sistema gera uma senha temporária. No primeiro acesso o cliente escolhe a senha dele.
      </p>
      <button disabled={pending} className={`${btnPrimary} disabled:opacity-60`}>
        {pending ? "Criando…" : "Criar cliente"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ clientId, loginUrl }: { clientId: string; loginUrl: string }) {
  const [state, formAction, pending] = useActionState(resetClientPasswordAction, initial);

  return (
    <div className="space-y-3">
      <ErrorBanner message={state.error} />
      {state.credentials && <CredentialsBox {...state.credentials} loginUrl={loginUrl} />}
      <form action={formAction}>
        <input type="hidden" name="clientId" value={clientId} />
        <button disabled={pending} className={`${btnGhost} disabled:opacity-60`}>
          {pending ? "Gerando…" : "Gerar nova senha temporária"}
        </button>
      </form>
    </div>
  );
}
