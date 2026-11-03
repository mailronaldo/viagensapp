"use client";

import { useState } from "react";
import { btnGhost } from "@/components/ui";

/** Mostra login + senha temporária uma única vez, com botão de copiar a mensagem pronta. */
export function CredentialsBox({
  name,
  email,
  tempPassword,
  loginUrl,
}: {
  name: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  const message =
    `Olá, ${name}! Seu acesso ao sistema de viagens está pronto.\n\n` +
    `Endereço: ${loginUrl}\nE-mail: ${email}\nSenha temporária: ${tempPassword}\n\n` +
    `No primeiro acesso você vai escolher uma senha só sua.`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
      <p className="mb-2 font-medium">
        Acesso gerado. Copie agora: a senha temporária não será exibida novamente.
      </p>
      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-emerald-800">Endereço</dt>
        <dd className="break-all">{loginUrl}</dd>
        <dt className="text-emerald-800">E-mail</dt>
        <dd className="break-all">{email}</dd>
        <dt className="text-emerald-800">Senha temporária</dt>
        <dd>
          <code className="rounded bg-white px-2 py-0.5 font-mono text-base tracking-wide">
            {tempPassword}
          </code>
        </dd>
      </dl>
      <button type="button" onClick={copy} className={btnGhost}>
        {copied ? "Copiado ✓" : "Copiar mensagem pronta"}
      </button>
    </div>
  );
}
