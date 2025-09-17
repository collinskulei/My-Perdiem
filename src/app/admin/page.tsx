
import { AdminDashboard } from "./admin-dashboard";

export const dynamic = "force-dynamic";

/**
 * The page component for the admin dashboard.
 * This is a Server Component that reads the 'tab' from the URL search parameters
 * and passes it to the client-side AdminDashboard component.
 *
 * @param {{ searchParams: { tab?: string } }} props - The props object, containing searchParams.
 * @returns {JSX.Element} The rendered admin dashboard page.
 */
export default function AdminDashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const tab = searchParams.tab || "requests";

  return <AdminDashboard currentTab={tab} />;
}
