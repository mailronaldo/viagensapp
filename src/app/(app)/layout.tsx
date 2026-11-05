import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { stopImpersonationAction } from "@/app/actions/agency";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, realUser, impersonating } = await requireAuth();

  // Senha temporária: só deixa seguir depois de trocar. (Quem personifica não é afetado.)
  if (!impersonating && realUser.mustChangePassword) redirect("/account/password");

  const isAgencyView = user.role === "MASTER";
  const isTraveler = user.role === "TRAVELER";

  return (
    <AppShell
      homeHref={isAgencyView ? "/agency" : isTraveler ? "/traveler" : "/"}
      role={isAgencyView ? "agency" : isTraveler ? "traveler" : "client"}
      userName={realUser.name}
      logoutAction={logoutAction}
      banner={
        impersonating && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900 lg:px-6">
            <span>
              Você está na área do cliente <strong>{user.name}</strong> ({user.email}).
              Tudo que fizer aqui altera os dados dele.
            </span>
            <form action={stopImpersonationAction}>
              <button className="cursor-pointer rounded-lg border border-amber-400 bg-white px-3 py-1 font-medium shadow-sm transition hover:bg-brand-50">
                ← Voltar à agência
              </button>
            </form>
          </div>
        )
      }
    >
      {children}
    </AppShell>
  );
}
