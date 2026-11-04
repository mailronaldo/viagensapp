import Link from "next/link";
import { requireTripAccess } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { TripSidebar, TripMobileTabs } from "@/components/shell/TripSidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Toolbar, ToolbarActions, ToolbarHeading, ToolbarPageTitle } from "@/components/ui/toolbar";
import { btnOutline } from "@/components/ui";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { trip, role } = await requireTripAccess(id);
  const basePath = `/trips/${trip.id}`;

  return (
    <div className="flex grow flex-col lg:flex-row">
      <TripSidebar basePath={basePath} />
      <div className="grow">
        <div className="mx-auto max-w-5xl">
          <TripMobileTabs basePath={basePath} />
          <Toolbar>
            <ToolbarHeading>
              <ToolbarPageTitle>{trip.title}</ToolbarPageTitle>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/">Viagens</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-xs text-muted-foreground">/</BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {trip.destination} · {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </ToolbarHeading>
            {role === "OWNER" && (
              <ToolbarActions>
                <Link href={`/trips/${trip.id}/edit`} className={btnOutline}>
                  Editar viagem
                </Link>
              </ToolbarActions>
            )}
          </Toolbar>
          {children}
        </div>
      </div>
    </div>
  );
}
