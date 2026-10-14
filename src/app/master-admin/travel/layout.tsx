import { TravelModuleLayout } from '@/app/admin/module-layouts';

/** Master Admin's Travel & Ground Transfers dashboard, across every client with the module on (see module-layouts.tsx). */
export default function MasterAdminTravelLayout({ children }: { children: React.ReactNode }) {
  return <TravelModuleLayout kind="master">{children}</TravelModuleLayout>;
}
