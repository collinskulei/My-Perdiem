
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { EmployeeDashboard } from "./employee-dashboard";


export default function EmployeeDashboardPage({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  const tab = searchParams?.tab || 'events';

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full w-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <EmployeeDashboard currentTab={tab} />
    </Suspense>
  );
}
