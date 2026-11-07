import { requireTripAccess } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { getTripCountryCodes } from "@/services/cities";
import { CountryFlag } from "@/components/CountryFlag";
import { SideNav, SideNavMobileTabs } from "@/components/shell/SideNav";
import { TripHeaderActions } from "@/components/TripHeaderActions";
import { Toolbar, ToolbarActions, ToolbarHeading, ToolbarPageTitle } from "@/components/ui/toolbar";

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
      <SideNav basePath={basePath} variant="trip" />
      <div className="grow">
        <div className="mx-auto max-w-5xl">
          <SideNavMobileTabs basePath={basePath} variant="trip" />
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
            <ToolbarActions>
              <TripHeaderActions tripId={trip.id} canEditTrip={role === "OWNER"} />
            </ToolbarActions>
          </Toolbar>
          {children}
        </div>
      </div>
    </div>
  );
}
