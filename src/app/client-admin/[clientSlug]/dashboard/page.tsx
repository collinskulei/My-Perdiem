import { AdminDashboard } from "@/app/admin/admin-dashboard";

export const dynamic = "force-dynamic";

/**
 * Client Admin's dashboard page - renders the shared AdminDashboard, scoped
 * to this portal's basePath so its internal tab navigation stays under
 * /<clientSlug>-admin/dashboard instead of the generic /admin. The
 * dashboard's dataset is prefetched one level up, in layout.tsx (see
 * get-initial-dashboard-data.ts) - not here, since this page re-renders on
 * every ?tab= sidebar click and a fetch here would re-run per click.
 */
export default async function ClientAdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientSlug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const [{ clientSlug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const tab = resolvedSearchParams.tab || "overview";

  return <AdminDashboard currentTab={tab} basePath={`/${clientSlug}-admin/dashboard`} />;
}
