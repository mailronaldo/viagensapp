import Link from "next/link";
import { requireTripAccess } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { countryFlag } from "@/lib/country-flags";
import { getTripCountries } from "@/services/cities";
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
  const countries = await getTripCountries(trip.id);

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
                {countries.length > 0 && (
                  <span className="flex items-center gap-1 text-lg" title={countries.join(", ")}>
                    {countries.map((c) => (
                      <span key={c}>{countryFlag(c)}</span>
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
