
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EmployeeDashboard } from "./employee-dashboard";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * The page component for the employee dashboard.
 * This is now a Client Component that forces dynamic rendering to avoid build errors.
 * It uses useSearchParams to read the 'tab' from the URL.
 *
 * @returns {JSX.Element} The rendered employee dashboard page.
 */
function DashboardPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "events";

  return <EmployeeDashboard currentTab={tab} />;
}

export default function EmployeeDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <DashboardPage />
    </Suspense>
  );
}
