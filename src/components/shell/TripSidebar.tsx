"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TRIP_NAV, TRIP_LINKS_FLAT } from "./trip-nav";

function isActive(pathname: string, basePath: string, href: string) {
  const full = `${basePath}${href}`;
  return href === "" ? pathname === basePath : pathname.startsWith(full);
}

const leafCls =
  "flex h-8.5 items-center gap-2.5 rounded-lg px-2.5 text-sm font-normal text-foreground hover:bg-brand-50 hover:text-brand-800 data-[active=true]:bg-brand-50 data-[active=true]:font-medium data-[active=true]:text-brand-800";

// MENU 2 (desktop): sub-navegação de uma viagem, fixa à esquerda. "Cadastros"
// é um grupo expansível que abre sozinho quando a rota atual é um de seus filhos.
export function TripSidebar({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const groupHasActiveChild = (children: { href: string }[]) =>
    children.some((c) => isActive(pathname, basePath, c.href));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      TRIP_NAV.filter((item) => item.kind === "group").map((item) => [item.label, groupHasActiveChild(item.children)]),
    ),
  );

  return (
    <aside className="hidden lg:sticky lg:top-(--header-height) lg:flex lg:h-[calc(100vh-var(--header-height))] lg:w-(--sidebar-width) lg:shrink-0 lg:flex-col lg:self-start lg:border-e lg:border-border">
      <ScrollArea className="h-full grow">
        <nav className="space-y-0.5 px-2.5 py-4">
          {TRIP_NAV.map((item) => {
            if (item.kind === "link") {
              const Icon = item.icon;
              const active = isActive(pathname, basePath, item.href);
              return (
                <Link key={item.href} href={`${basePath}${item.href}`} data-active={active || undefined} className={leafCls}>
                  <Icon className="size-4 opacity-60" />
                  <span>{item.label}</span>
                </Link>
              );
            }

            const Icon = item.icon;
            const open = openGroups[item.label] ?? groupHasActiveChild(item.children);
            const groupActive = groupHasActiveChild(item.children);
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [item.label]: !open }))}
                  className={cn(
                    "flex h-8.5 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-normal text-foreground hover:bg-brand-50 hover:text-brand-800",
                    groupActive && "font-medium text-brand-800",
                  )}
                  aria-expanded={open}
                >
                  <Icon className="size-4 opacity-60" />
                  <span>{item.label}</span>
                  <ChevronDown className={cn("ms-auto size-3.5 text-muted-foreground transition-transform", open && "-rotate-180")} />
                </button>
                {open && (
                  <div className="ms-5 space-y-0.5 border-s border-border ps-2.5">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const active = isActive(pathname, basePath, child.href);
                      return (
                        <Link key={child.href} href={`${basePath}${child.href}`} data-active={active || undefined} className={leafCls}>
                          <ChildIcon className="size-4 opacity-60" />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}

// Mesma sub-navegação, achatada e em faixa horizontal rolável — usada no
// lugar do MENU 2 fixo quando a tela é pequena demais para uma sidebar.
export function TripMobileTabs({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  return (
    <nav className="thin-scroll -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border px-4 lg:hidden">
      {TRIP_LINKS_FLAT.map((item) => {
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
