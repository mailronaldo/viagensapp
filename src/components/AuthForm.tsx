"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  loginAction,
  registerAction,
  type AuthState,
} from "@/app/actions/auth";
import { Field, ErrorBanner, btnPrimary, inputCls } from "@/components/ui";

const initial: AuthState = {};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, formAction, pending] = useActionState(
    mode === "login" ? loginAction : registerAction,
    initial,
  );

  return (
    <form action={formAction} className="space-y-4">
      <ErrorBanner message={state.error} />
      {mode === "register" && (
        <Field label="Nome">
          <input name="name" required autoComplete="name" className={inputCls} />
        </Field>
      )}
      <Field label="E-mail">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputCls}
        />
      </Field>
      <Field
        label="Senha"
        hint={mode === "register" ? "Mínimo de 8 caracteres." : undefined}
      >
        <input
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={inputCls}
        />
      </Field>
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full disabled:opacity-60`}>
        {pending ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
      </button>
      <p className="text-center text-sm text-slate-500">
        {mode === "login" ? (
          <>
            Ainda não tem conta?{" "}
            <Link href="/register" className="font-medium text-teal-700 hover:underline">
              Cadastre-se
            </Link>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-teal-700 hover:underline">
              Entrar
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
