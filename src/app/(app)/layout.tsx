import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { stopImpersonationAction } from "@/app/actions/agency";

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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href={isAgencyView ? "/agency" : isTraveler ? "/traveler" : "/"} className="text-base font-semibold text-teal-800">
              ✈ Minhas Viagens
              {isAgencyView && <span className="ml-2 text-xs font-normal text-slate-500">Agência</span>}
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              {isAgencyView ? (
                <Link href="/agency" className="hover:text-teal-800">
                  Clientes
                </Link>
              ) : isTraveler ? (
                <Link href="/traveler" className="hover:text-teal-800">
                  Minhas viagens
                </Link>
              ) : (
                <>
                  <Link href="/" className="hover:text-teal-800">
                    Viagens
                  </Link>
                  <Link href="/travelers" className="hover:text-teal-800">
                    Viajantes
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="hidden sm:inline">{realUser.name}</span>
            <Link href="/account/password" className="hidden hover:text-teal-800 sm:inline">
              Senha
            </Link>
            <form action={logoutAction}>
              <button className="cursor-pointer rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</div>
    </>
  );
}
