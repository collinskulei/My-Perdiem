/**
 * @file Guards the Master Admin's Per Diem Payments dashboard: every request
 * here is checked server-side by resolvePortal() (portal-access.ts) - no
 * session, or one that isn't access_tier = 'master_admin', bounces back to
 * the Master Admin login page (not the generic '/').
 */
import { AdminLayoutClient } from '@/app/admin/admin-layout';
import { AdminDashboardDataProvider } from '@/app/admin/admin-dashboard-data-context';
import { getInitialAdminDashboardData } from '@/app/admin/get-initial-dashboard-data';
import { resolvePortal } from '@/app/admin/portal-access';

export default async function MasterAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, portal } = await resolvePortal('master');

  // Prefetched here rather than in page.tsx - see the matching comment in
  // src/app/admin/layout.tsx for why (page.tsx re-renders per ?tab= click).
  const initialData = await getInitialAdminDashboardData(supabase);

  return (
    <AdminDashboardDataProvider data={initialData}>
      <AdminLayoutClient basePath="/master-admin/dashboard" loginPath="/master-admin" portalLabel="Master Admin" portal={portal} activeModule="perdiem">
        {children}
      </AdminLayoutClient>
    </AdminDashboardDataProvider>
  );
}
