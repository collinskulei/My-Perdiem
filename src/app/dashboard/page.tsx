
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { EmployeeDashboard } from "./employee-dashboard";

export const dynamic = "force-dynamic";

/**
 * The page component for the employee dashboard.
 * This is a Server Component that reads the 'tab' from the URL search parameters
 * and passes it to the client-side EmployeeDashboard component.
 *
 * @param {{ searchParams: { tab?: string } }} props - The props object, containing searchParams.
 * @returns {JSX.Element} The rendered employee dashboard page.
 */
export default function DashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const tab = searchParams.tab || "events";

  return (
    <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <EmployeeDashboard currentTab={tab} />
    </Suspense>
  );
}
