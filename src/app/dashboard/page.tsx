
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { EmployeeDashboardWrapper } from "./employee-dashboard";


export default function EmployeeDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full w-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <EmployeeDashboardWrapper />
    </Suspense>
  );
}
