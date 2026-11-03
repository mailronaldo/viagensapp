"use client";

import { useActionState } from "react";
import { changePasswordAction, type AuthState } from "@/app/actions/auth";
import { Field, ErrorBanner, btnPrimary, inputCls } from "@/components/ui";

const initial: AuthState = {};

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <ErrorBanner message={state.error} />
      <Field label="Senha atual (ou temporária)">
        <input name="current" type="password" required autoComplete="current-password" className={inputCls} />
      </Field>
      <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
        <input name="next" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </Field>
      <Field label="Repita a nova senha">
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </Field>
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full disabled:opacity-60`}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
