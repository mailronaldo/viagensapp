import Link from "next/link";
import { HeaderMenu } from "./HeaderMenu";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import type { NavRole } from "./nav-links";

export function Header({
  homeHref,
  role,
  userName,
  logoutAction,
}: {
  homeHref: string;
  role: NavRole;
  userName: string;
  logoutAction: () => void;
}) {
  return (
    <header className="app-header fixed inset-x-0 top-0 z-20 flex h-(--header-height-mobile) items-center justify-between gap-3 border-b border-border bg-background px-4 lg:h-(--header-height) lg:px-6">
      <div className="flex items-center gap-3">
        <MobileNav role={role} />
        <Link href={homeHref} className="flex items-center gap-2 text-base font-semibold tracking-tight text-brand-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-800 text-sm text-white">✈️</span>
          <span className="hidden sm:inline">Minhas Viagens</span>
        </Link>
      </div>
      <HeaderMenu role={role} className="hidden lg:flex" />
      <UserMenu userName={userName} logoutAction={logoutAction} />
    </header>
  );
}
