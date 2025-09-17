
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import AdminDashboard from "./admin-dashboard";
import { useSearchParams } from "next/navigation";

function AdminDashboardWrapper() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'requests';
  return <AdminDashboard currentTab={initialTab} />;
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AdminDashboardWrapper />
    </Suspense>
  );
}
