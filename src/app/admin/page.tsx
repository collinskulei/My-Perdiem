
import { AdminDashboard } from "./admin-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInitialAdminDashboardData } from "./get-initial-dashboard-data";

export const dynamic = "force-dynamic";

/**
 * The page component for the admin dashboard.
 * This is a Server Component that reads the 'tab' from the URL search parameters,
 * prefetches the dashboard's dataset (see get-initial-dashboard-data.ts) so
 * AdminDashboard renders with data already in hand, and passes both to the
 * client-side AdminDashboard component.
 *
 * @param {{ searchParams: { tab?: string } }} props - The props object, containing searchParams.
 * @returns {Promise<JSX.Element>} The rendered admin dashboard page.
 */
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const tab = searchParams.tab || "requests";
  const supabase = await createSupabaseServerClient();
  const initialData = await getInitialAdminDashboardData(supabase);

  return <AdminDashboard currentTab={tab} initialData={initialData} />;
}
