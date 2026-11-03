import { requireAuth } from "@/lib/auth";

// Fica fora do layout principal de propósito: quem precisa trocar a senha é enviado para cá
// e não pode ficar preso num redirecionamento.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      {children}
    </main>
  );
}
