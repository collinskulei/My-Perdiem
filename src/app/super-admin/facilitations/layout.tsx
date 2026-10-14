import { FacilitationsModuleLayout } from '@/app/admin/module-layouts';

/** Super Admin's Other Project Facilitations dashboard, across every client with the module on (see module-layouts.tsx). */
export default function SuperAdminFacilitationsLayout({ children }: { children: React.ReactNode }) {
  return <FacilitationsModuleLayout kind="super">{children}</FacilitationsModuleLayout>;
}
