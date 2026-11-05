import { requireClient } from "@/lib/auth";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Suporte ao cliente" };

export default async function SupportPage() {
  await requireClient();
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Suporte ao cliente</h1>
      <p className="mb-6 text-sm text-slate-500">Em breve.</p>
      <EmptyState>Essa área ainda está sendo construída.</EmptyState>
    </>
  );
}
