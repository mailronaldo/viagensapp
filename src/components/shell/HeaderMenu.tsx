"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNavLinks, type NavRole } from "./nav-links";

export function HeaderMenu({ role, className }: { role: NavRole; className?: string }) {
  const pathname = usePathname();
  const items = getNavLinks(role);
  // "/" também é a raiz das viagens do cliente, que moram em /trips.
  const matches = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/trips") : pathname.startsWith(href);
  // Com vários links sob o mesmo prefixo (ex.: "/agency" e "/agency/system"),
  // só o mais específico (o de maior prefixo) fica marcado como ativo.
  const allHrefs = items.flatMap((item) => (item.kind === "link" ? [item.href] : item.children.map((c) => c.href)));
  const bestHref = allHrefs.filter(matches).sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === bestHref;

  return (
    <nav className={cn("flex items-stretch gap-1.5", className)}>
      {items.map((item) => {
        const Icon = item.icon;

        if (item.kind === "group") {
          const groupActive = item.children.some((c) => isActive(c.href));
          return (
            <DropdownMenu key={item.label}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "inline-flex items-center gap-2 text-sm font-medium",
                    groupActive
                      ? "bg-brand-50 text-brand-800"
                      : "text-secondary-foreground hover:bg-brand-50 hover:text-brand-800",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                  <ChevronDown className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {item.children.map((child) => {
                  const ChildIcon = child.icon;
                  return (
                    <DropdownMenuItem key={child.href} asChild>
                      <Link href={child.href} aria-current={isActive(child.href) ? "page" : undefined}>
                        <ChildIcon /> {child.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        const active = isActive(item.href);
        return (
          <Button
            key={item.href}
            variant="ghost"
            asChild
            className={cn(
              "inline-flex items-center gap-2 text-sm font-medium",
              active
                ? "bg-brand-50 text-brand-800"
                : "text-secondary-foreground hover:bg-brand-50 hover:text-brand-800",
            )}
          >
            <Link href={item.href} aria-current={active ? "page" : undefined}>
              <Icon className="size-4" />
              {item.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
