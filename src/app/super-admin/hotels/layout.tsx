import { HotelsModuleLayout } from '@/app/admin/module-layouts';

/** Super Admin's Hotel Bookings dashboard, across every client with the module on (see module-layouts.tsx). */
export default function SuperAdminHotelsLayout({ children }: { children: React.ReactNode }) {
  return <HotelsModuleLayout kind="super">{children}</HotelsModuleLayout>;
}
