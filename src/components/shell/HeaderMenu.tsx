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
import { getNavItems, type NavRole } from "./nav-links";

export function HeaderMenu({ role, className }: { role: NavRole; className?: string }) {
  const pathname = usePathname();
  const items = getNavItems(role);
  // "/" também é a raiz das viagens do cliente, que moram em /trips.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/trips") : pathname.startsWith(href);
  const activeCls = "bg-brand-50 text-brand-800";
  const inactiveCls = "text-secondary-foreground hover:bg-brand-50 hover:text-brand-800";
  const itemCls = "focus:bg-brand-50 focus:text-brand-800 data-[state=open]:bg-brand-50 data-[state=open]:text-brand-800";

  return (
    <nav className={cn("flex items-stretch gap-1.5", className)}>
      {items.map((item) => {
        if (item.kind === "link") {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Button
              key={item.href}
              variant="ghost"
              asChild
              className={cn("inline-flex items-center gap-2 text-sm font-medium", active ? activeCls : inactiveCls)}
            >
              <Link href={item.href} aria-current={active ? "page" : undefined}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          );
        }

        const Icon = item.icon;
        const active = item.children.some((c) => isActive(c.href));
        return (
          <DropdownMenu key={item.label}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn("inline-flex items-center gap-2 text-sm font-medium", active ? activeCls : inactiveCls)}
              >
                <Icon className="size-4" />
                {item.label}
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {item.children.map((child) => {
                const ChildIcon = child.icon;
                const childActive = isActive(child.href);
                return (
                  <DropdownMenuItem key={child.href} asChild className={cn(itemCls, childActive && activeCls)}>
                    <Link href={child.href}>
                      <ChildIcon className="size-4" />
                      {child.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
