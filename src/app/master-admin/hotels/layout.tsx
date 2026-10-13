import { HotelsModuleLayout } from '@/app/admin/module-layouts';

/** Master Admin's Hotel Bookings dashboard, across every client with the module on (see module-layouts.tsx). */
export default function MasterAdminHotelsLayout({ children }: { children: React.ReactNode }) {
  return <HotelsModuleLayout kind="master">{children}</HotelsModuleLayout>;
}
