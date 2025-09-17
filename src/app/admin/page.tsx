
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AdminDashboardWrapper } from "./admin-dashboard";

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full w-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AdminDashboardWrapper />
    </Suspense>
  );
}
