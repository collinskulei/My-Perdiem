import { FundingModuleLayout } from '@/app/admin/module-layouts';

/** Master Admin's Funding & Refunds dashboard, across every client with the module on (see module-layouts.tsx). */
export default function MasterAdminFundingLayout({ children }: { children: React.ReactNode }) {
  return <FundingModuleLayout kind="master">{children}</FundingModuleLayout>;
}
