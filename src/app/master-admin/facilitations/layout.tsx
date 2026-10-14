import { FacilitationsModuleLayout } from '@/app/admin/module-layouts';

/** Master Admin's Other Project Facilitations dashboard, across every client with the module on (see module-layouts.tsx). */
export default function MasterAdminFacilitationsLayout({ children }: { children: React.ReactNode }) {
  return <FacilitationsModuleLayout kind="master">{children}</FacilitationsModuleLayout>;
}
