
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { EmployeeDashboard } from "./employee-dashboard";

export const dynamic = "force-dynamic";

/**
 * The page component for the employee dashboard.
 * This is a Server Component that reads the 'tab' from the URL search parameters
 * and passes it to the client-side EmployeeDashboard component.
 *
 * @param {{ searchParams: Promise<{ tab?: string }> }} props - The props object, containing searchParams
 * (a Promise as of Next.js 15 - must be awaited before reading its properties).
 * @returns {Promise<JSX.Element>} The rendered employee dashboard page.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const tab = params.tab || "events";

  return (
    <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <EmployeeDashboard currentTab={tab} />
    </Suspense>
  );
}
