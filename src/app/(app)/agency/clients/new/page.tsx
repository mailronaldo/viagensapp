import Link from "next/link";
import { requireMaster } from "@/lib/auth";
import { getLoginUrl } from "@/lib/origin";
import { NewClientForm } from "@/components/ClientForms";
import { Card } from "@/components/ui";

export const metadata = { title: "Novo cliente · Agência" };

export default async function NewClientPage() {
  await requireMaster();
  const loginUrl = await getLoginUrl();

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/agency" className="text-xs text-slate-500 hover:underline">
        ← Clientes
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold">Novo cliente</h1>
      <Card>
        <NewClientForm loginUrl={loginUrl} />
      </Card>
    </div>
  );
}
