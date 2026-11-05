"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getNavLinks, type NavRole } from "./nav-links";

export function HeaderMenu({ role, className }: { role: NavRole; className?: string }) {
  const pathname = usePathname();
  const links = getNavLinks(role);
  // "/" também é a raiz das viagens do cliente, que moram em /trips.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/trips") : pathname.startsWith(href);

  return (
    <nav className={cn("flex items-stretch gap-1.5", className)}>
      {links.map((link) => {
        const Icon = link.icon;
        const active = isActive(link.href);
        return (
          <Button
            key={link.href}
            variant="ghost"
            asChild
            className={cn(
              "inline-flex items-center gap-2 text-sm font-medium",
              active
                ? "bg-brand-50 text-brand-800"
                : "text-secondary-foreground hover:bg-brand-50 hover:text-brand-800",
            )}
          >
            <Link href={link.href} aria-current={active ? "page" : undefined}>
              <Icon className="size-4" />
              {link.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
