import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/AuthForm";
import { Card } from "@/components/ui";

export const metadata = { title: "Entrar · Minhas Viagens" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="mb-1 text-2xl font-semibold text-brand-800">✈ Minhas Viagens</h1>
      <p className="mb-6 text-sm text-slate-500">
        Entre para gerenciar roteiros, reservas, custos e documentos.
      </p>
      <Card>
        <LoginForm />
      </Card>
    </main>
  );
}
