
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import EmployeeDashboard from "./employee-dashboard";

function EmployeeDashboardWrapper() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'events';
  return <EmployeeDashboard currentTab={initialTab} />;
}

export default function EmployeeDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <EmployeeDashboardWrapper />
    </Suspense>
  );
}
