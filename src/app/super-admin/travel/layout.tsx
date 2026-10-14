import { TravelModuleLayout } from '@/app/admin/module-layouts';

/** Super Admin's Travel & Ground Transfers dashboard, across every client with the module on (see module-layouts.tsx). */
export default function SuperAdminTravelLayout({ children }: { children: React.ReactNode }) {
  return <TravelModuleLayout kind="super">{children}</TravelModuleLayout>;
}
