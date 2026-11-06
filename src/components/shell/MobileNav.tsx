"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getNavLinks, type NavRole } from "./nav-links";

export function MobileNav({ role }: { role: NavRole }) {
  const [open, setOpen] = useState(false);
  const items = getNavLinks(role);

  return (
    <>
      <Button variant="ghost" mode="icon" aria-label="Abrir menu" className="lg:hidden" onClick={() => setOpen(true)}>
        <Menu className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <nav className="flex flex-col gap-1 p-3">
            {items.map((item) => {
              const Icon = item.icon;
              if (item.kind === "group") {
                return (
                  <div key={item.label} className="mt-2 first:mt-0">
                    <p className="flex items-center gap-2.5 px-3 py-1 text-xs font-medium text-muted-foreground">
                      <Icon className="size-4" />
                      {item.label}
                    </p>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2.5 rounded-lg py-2 pl-8 pr-3 text-sm font-medium text-foreground hover:bg-brand-50 hover:text-brand-800"
                        >
                          <ChildIcon className="size-4" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-brand-50 hover:text-brand-800"
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
