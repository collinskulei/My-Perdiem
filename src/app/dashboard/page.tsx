
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { EmployeeDashboard } from "./employee-dashboard";


function DashboardContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'events';

  return <EmployeeDashboard currentTab={tab} />;
}

export default function EmployeeDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full w-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
