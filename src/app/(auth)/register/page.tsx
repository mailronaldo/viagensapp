import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui";

export const metadata = { title: "Criar conta · Minhas Viagens" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="mb-1 text-2xl font-semibold">Criar conta</h1>
      <p className="mb-6 text-sm text-slate-500">
        Organize cada viagem em um só lugar.
      </p>
      <Card>
        <AuthForm mode="register" />
      </Card>
    </main>
  );
}
