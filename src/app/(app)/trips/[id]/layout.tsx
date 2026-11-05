import Link from "next/link";
import { requireTripAccess } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { getTripCountryCodes } from "@/services/cities";
import { CountryFlag } from "@/components/CountryFlag";
import { TripSidebar, TripMobileTabs } from "@/components/shell/TripSidebar";
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
  const countryCodes = await getTripCountryCodes(trip.id);

  return (
    <div className="flex grow flex-col lg:flex-row">
      <TripSidebar basePath={basePath} />
      <div className="grow">
        <div className="mx-auto max-w-5xl">
          <TripMobileTabs basePath={basePath} />
          <Toolbar>
            <ToolbarHeading>
              <div className="flex items-center gap-2">
                <ToolbarPageTitle>{trip.title}</ToolbarPageTitle>
                {countryCodes.length > 0 && (
                  <span className="flex items-center gap-1">
                    {countryCodes.map((code) => (
                      <CountryFlag key={code} code={code} className="h-5 w-[1.667em] rounded-[3px] object-cover shadow-sm" />
                    ))}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
              </p>
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
