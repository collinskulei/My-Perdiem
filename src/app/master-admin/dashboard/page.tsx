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
export default async function MasterAdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const tab = params.tab || "overview";

  return <AdminDashboard currentTab={tab} basePath="/master-admin/dashboard" />;
}
