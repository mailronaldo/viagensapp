"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { TRIP_NAV } from "./trip-nav";

function isActive(pathname: string, basePath: string, href: string) {
  const full = `${basePath}${href}`;
  return href === "" ? pathname === basePath : pathname.startsWith(full);
}

function activeCrumbs(pathname: string, basePath: string): string[] {
  for (const item of TRIP_NAV) {
    if (item.kind === "link") {
      if (isActive(pathname, basePath, item.href)) return [item.label];
    } else {
      for (const child of item.children) {
        if (isActive(pathname, basePath, child.href)) return [item.label, child.label];
      }
    }
  }
  return [];
}

// Linha 3 do cabeçalho da viagem: "Viagens / <grupo, se houver> / <página atual>".
export function TripBreadcrumb({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const crumbs = activeCrumbs(pathname, basePath);

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs">
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Viagens</BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((label, i) => (
          <Fragment key={label}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className={i < crumbs.length - 1 ? "text-muted-foreground" : undefined}>
                {label}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
