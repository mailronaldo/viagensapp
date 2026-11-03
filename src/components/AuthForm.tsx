"use client";

import { useActionState } from "react";
import { loginAction, type AuthState } from "@/app/actions/auth";
import { Field, ErrorBanner, btnPrimary, inputCls } from "@/components/ui";

const initial: AuthState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <ErrorBanner message={state.error} />
      <Field label="E-mail">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputCls}
        />
      </Field>
      <Field label="Senha">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </Field>
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full disabled:opacity-60`}>
        {pending ? "Aguarde…" : "Entrar"}
      </button>
      <p className="text-center text-xs text-slate-500">
        O acesso é criado pela sua agência de viagens. Não tem login? Fale com ela.
      </p>
    </form>
  );
}
