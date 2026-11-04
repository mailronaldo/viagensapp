import type { ReactNode } from "react";
import { Header } from "./Header";
import type { NavRole } from "./nav-links";

export function AppShell({
  homeHref,
  role,
  userName,
  logoutAction,
  banner,
  children,
}: {
  homeHref: string;
  role: NavRole;
  userName: string;
  logoutAction: () => void;
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-shell flex min-h-full grow flex-col bg-background">
      <Header homeHref={homeHref} role={role} userName={userName} logoutAction={logoutAction} />
      <div className="flex grow flex-col pt-(--header-height-mobile) lg:pt-(--header-height)">
        {banner}
        <main role="content" className="grow px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
