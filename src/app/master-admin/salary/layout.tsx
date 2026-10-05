import { SalaryModuleLayout } from '@/app/admin/module-layouts';

/** Master Admin's Salary Payments dashboard, across every client with the module on (see module-layouts.tsx). */
export default function MasterAdminSalaryLayout({ children }: { children: React.ReactNode }) {
  return <SalaryModuleLayout kind="master">{children}</SalaryModuleLayout>;
}
