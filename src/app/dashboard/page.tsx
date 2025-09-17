/**
 * @file This file defines the main dashboard page for an authenticated employee.
 * It displays a welcome message, a list of upcoming events, and a table of the user's recent per diem requests.
 */
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import EmployeeDashboard from "./employee-dashboard";

export default function EmployeeDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <EmployeeDashboard />
    </Suspense>
  )
}
