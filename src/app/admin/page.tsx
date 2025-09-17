
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdminDashboard } from "./admin-dashboard";

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'requests';

  return <AdminDashboard currentTab={tab} />;
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full w-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}
