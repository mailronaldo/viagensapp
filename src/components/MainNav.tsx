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
    <nav className="thin-scroll flex gap-1 overflow-x-auto pb-3 pt-2 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(link.href) ? "page" : undefined}
          className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 transition ${
            isActive(link.href)
              ? "border-white/10 bg-white text-brand-800 font-medium shadow-sm"
              : "border-transparent text-brand-100 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span aria-hidden>{link.icon}</span> {link.label}
        </Link>
      ))}
    </nav>
  );
}
