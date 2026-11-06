import { requireMaster } from "@/lib/auth";
import { SideNav, SideNavMobileTabs } from "@/components/shell/SideNav";

export default async function AgencySystemLayout({ children }: { children: React.ReactNode }) {
  await requireMaster();
  const basePath = "/agency/system";

  return (
    <div className="flex grow flex-col lg:flex-row">
      <SideNav basePath={basePath} variant="system" />
      <div className="grow">
        <div className="mx-auto max-w-3xl">
          <SideNavMobileTabs basePath={basePath} variant="system" />
          {children}
        </div>
      </div>
    </div>
  );
}
