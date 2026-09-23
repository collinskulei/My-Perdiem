
import { AdminDashboard } from "./admin-dashboard";

export const dynamic = "force-dynamic";

/**
 * The page component for the admin dashboard.
 * This is a Server Component that reads the 'tab' from the URL search parameters
 * and passes it to the client-side AdminDashboard component. The dashboard's
 * dataset itself is prefetched one level up, in layout.tsx (see
 * get-initial-dashboard-data.ts) - not here, since this page re-renders on
 * every ?tab= sidebar click and a fetch here would re-run per click.
 *
 * @param {{ searchParams: Promise<{ tab?: string }> }} props - The props object, containing searchParams
 * (a Promise as of Next.js 15 - must be awaited before reading its properties).
 * @returns {Promise<JSX.Element>} The rendered admin dashboard page.
 */
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const tab = params.tab || "overview";

  return <AdminDashboard currentTab={tab} />;
}
