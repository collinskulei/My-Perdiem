import { FundingModuleLayout } from '@/app/admin/module-layouts';

/** Super Admin's Refunds dashboard, across every client with the module on (see module-layouts.tsx). */
export default function SuperAdminFundingLayout({ children }: { children: React.ReactNode }) {
  return <FundingModuleLayout kind="super">{children}</FundingModuleLayout>;
}
