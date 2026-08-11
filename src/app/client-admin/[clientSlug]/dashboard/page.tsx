import { AdminDashboard } from "@/app/admin/admin-dashboard";

export const dynamic = "force-dynamic";

/**
 * Client Admin's dashboard page - renders the shared AdminDashboard, scoped
 * to this portal's basePath so its internal tab navigation stays under
 * /<clientSlug>-admin/dashboard instead of the generic /admin.
 */
export default function ClientAdminDashboardPage({
  params,
  searchParams,
}: {
  params: { clientSlug: string };
  searchParams: { [key: string]: string | undefined };
}) {
  const tab = searchParams.tab || "requests";

  return <AdminDashboard currentTab={tab} basePath={`/${params.clientSlug}-admin/dashboard`} />;
}
