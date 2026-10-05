import { SalaryModuleLayout } from '@/app/admin/module-layouts';

/** Super Admin's Salary Payments dashboard, across every client with the module on (see module-layouts.tsx). */
export default function SuperAdminSalaryLayout({ children }: { children: React.ReactNode }) {
  return <SalaryModuleLayout kind="super">{children}</SalaryModuleLayout>;
}
