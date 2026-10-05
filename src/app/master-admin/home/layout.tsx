import { HomeModuleLayout } from '@/app/admin/module-layouts';

/** Master Admin Home - overall Insights across every module (see module-layouts.tsx). */
export default function MasterAdminHomeLayout({ children }: { children: React.ReactNode }) {
  return <HomeModuleLayout kind="master">{children}</HomeModuleLayout>;
}
