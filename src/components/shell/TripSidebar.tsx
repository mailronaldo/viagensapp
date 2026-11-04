"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TRIP_LINKS } from "./trip-nav";

function isActive(pathname: string, basePath: string, href: string) {
  const full = `${basePath}${href}`;
  return href === "" ? pathname === basePath : pathname.startsWith(full);
}

// MENU 2 (desktop): sub-navegação de uma viagem, fixa à esquerda.
export function TripSidebar({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:sticky lg:top-(--header-height) lg:flex lg:h-[calc(100vh-var(--header-height))] lg:w-(--sidebar-width) lg:shrink-0 lg:flex-col lg:self-start lg:border-e lg:border-border">
      <ScrollArea className="h-full grow">
        <nav className="space-y-0.5 px-2.5 py-4">
          {TRIP_LINKS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, basePath, item.href);
            return (
              <Link
                key={item.href}
                href={`${basePath}${item.href}`}
                data-active={active || undefined}
                className={cn(
                  "flex h-8.5 items-center gap-2.5 rounded-lg px-2.5 text-sm font-normal text-foreground hover:text-primary",
                  "data-[active=true]:bg-muted data-[active=true]:font-medium",
                )}
              >
                <Icon className="size-4 opacity-60" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}

// Mesma sub-navegação, em faixa horizontal rolável — usada no lugar do MENU 2
// fixo quando a tela é pequena demais para uma sidebar.
export function TripMobileTabs({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  return (
    <nav className="thin-scroll -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border px-4 lg:hidden">
      {TRIP_LINKS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, basePath, item.href);
        return (
          <Link
            key={item.href}
            href={`${basePath}${item.href}`}
            data-active={active || undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2 py-2.5 text-sm font-medium text-muted-foreground",
              "data-[active=true]:border-primary data-[active=true]:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
