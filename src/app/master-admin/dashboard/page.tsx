import { AdminDashboard } from "@/app/admin/admin-dashboard";

export const dynamic = "force-dynamic";

/**
 * Master Admin's dashboard page - renders the shared AdminDashboard, scoped
 * to this portal's basePath so its internal tab navigation stays under
 * /master-admin/dashboard instead of the generic /admin. The dashboard's
 * dataset is prefetched one level up, in layout.tsx (see
 * get-initial-dashboard-data.ts) - not here, since this page re-renders on
 * every ?tab= sidebar click and a fetch here would re-run per click.
 */
export default function MasterAdminDashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const tab = searchParams.tab || "requests";

  return <AdminDashboard currentTab={tab} basePath="/master-admin/dashboard" />;
}
