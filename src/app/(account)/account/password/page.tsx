import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { PasswordForm } from "@/components/PasswordForm";
import { Card } from "@/components/ui";

export const metadata = { title: "Trocar senha · Minhas Viagens" };

export default async function PasswordPage() {
  const { realUser } = await requireAuth();
  const forced = realUser.mustChangePassword;

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">
        {forced ? "Defina sua senha" : "Trocar senha"}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {forced
          ? "Você entrou com uma senha temporária. Escolha uma senha só sua para continuar."
          : "Informe a senha atual e escolha a nova."}
      </p>
      <Card>
        <PasswordForm />
      </Card>
      {!forced && (
        <Link href="/" className="mt-4 text-center text-sm text-slate-500 hover:underline">
          Voltar
        </Link>
      )}
    </>
  );
}
