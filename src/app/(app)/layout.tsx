import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { stopImpersonationAction } from "@/app/actions/agency";
import { MainNav } from "@/components/MainNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, realUser, impersonating } = await requireAuth();

  // Senha temporária: só deixa seguir depois de trocar. (Quem personifica não é afetado.)
  if (!impersonating && realUser.mustChangePassword) redirect("/account/password");

  const isAgencyView = user.role === "MASTER";
  const isTraveler = user.role === "TRAVELER";

  return (
    <>
      {impersonating && (
        <div className="border-b border-amber-300 bg-amber-100 text-amber-900">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
            <span>
              Você está na área do cliente <strong>{user.name}</strong> ({user.email}).
              Tudo que fizer aqui altera os dados dele.
            </span>
            <form action={stopImpersonationAction}>
              <button className="cursor-pointer rounded-md border border-amber-400 bg-white px-3 py-1 font-medium hover:bg-amber-50">
                ← Voltar à agência
              </button>
            </form>
          </div>
        </div>
      )}
      <header className="bg-brand-800 text-white">
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <div className="flex items-center justify-between gap-4">
            <Link href={isAgencyView ? "/agency" : isTraveler ? "/traveler" : "/"} className="text-lg font-semibold">
              ✈ Minhas Viagens
              {isAgencyView && <span className="ml-2 text-xs font-normal text-brand-100">Agência</span>}
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden sm:inline">{realUser.name}</span>
              <Link href="/account/password" className="hidden hover:underline sm:inline">
                Senha
              </Link>
              <form action={logoutAction}>
                <button className="cursor-pointer rounded-lg border border-white/70 px-3 py-1 hover:bg-white/10">
                  Sair
                </button>
              </form>
            </div>
          </div>
          <MainNav
            links={
              isAgencyView
                ? [{ href: "/agency", label: "Clientes", icon: "👥" }]
                : isTraveler
                  ? [{ href: "/traveler", label: "Minhas viagens", icon: "🧳" }]
                  : [
                      { href: "/", label: "Viagens", icon: "🧳" },
                      { href: "/travelers", label: "Viajantes", icon: "👥" },
                    ]
            }
          />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</div>
    </>
  );
}
