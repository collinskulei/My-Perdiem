
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AdminDashboard } from "./admin-dashboard";

export default function AdminDashboardPage({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  const tab = searchParams?.tab || 'requests';

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full w-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AdminDashboard currentTab={tab} />
    </Suspense>
  );
}
