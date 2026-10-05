import { HomeModuleLayout } from '@/app/admin/module-layouts';

/** Super Admin Home - overall Insights across every module (see module-layouts.tsx). */
export default function SuperAdminHomeLayout({ children }: { children: React.ReactNode }) {
  return <HomeModuleLayout kind="super">{children}</HomeModuleLayout>;
}
