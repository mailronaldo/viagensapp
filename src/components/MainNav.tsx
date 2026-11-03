"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; icon: string };

export function MainNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  // "/" também é a raiz das viagens do cliente, que moram em /trips.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/trips") : pathname.startsWith(href);
  return (
    <nav className="flex gap-1 overflow-x-auto pb-3 pt-2 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(link.href) ? "page" : undefined}
          className={`whitespace-nowrap rounded-full border px-3 py-1.5 ${
            isActive(link.href) ? "border-white bg-white/15 font-medium" : "border-transparent hover:bg-white/10"
          }`}
        >
          <span aria-hidden>{link.icon}</span> {link.label}
        </Link>
      ))}
    </nav>
  );
}
