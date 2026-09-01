import { AdminDashboard } from "@/app/admin/admin-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInitialAdminDashboardData } from "@/app/admin/get-initial-dashboard-data";

export const dynamic = "force-dynamic";

/**
 * Client Admin's dashboard page - renders the shared AdminDashboard, scoped
 * to this portal's basePath so its internal tab navigation stays under
 * /<clientSlug>-admin/dashboard instead of the generic /admin. Prefetches
 * the dashboard's dataset server-side (see get-initial-dashboard-data.ts,
 * RLS narrows it to this client automatically) so it renders with data
 * already in hand instead of a loading state.
 */
export default async function ClientAdminDashboardPage({
  params,
  searchParams,
}: {
  params: { clientSlug: string };
  searchParams: { [key: string]: string | undefined };
}) {
  const tab = searchParams.tab || "requests";
  const supabase = await createSupabaseServerClient();
  const initialData = await getInitialAdminDashboardData(supabase);

  return <AdminDashboard currentTab={tab} basePath={`/${params.clientSlug}-admin/dashboard`} initialData={initialData} />;
}
