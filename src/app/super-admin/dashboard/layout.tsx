/**
 * @file Guards the Super Admin's Per Diem Payments dashboard: every request
 * here is checked server-side by resolvePortal() (portal-access.ts - the
 * access rules, including the TEMPORARY master_admin testing exception,
 * live there and are shared with this portal's Home and Salary pages).
 */
import { AdminLayoutClient } from '@/app/admin/admin-layout';
import { AdminDashboardDataProvider } from '@/app/admin/admin-dashboard-data-context';
import { getInitialAdminDashboardData } from '@/app/admin/get-initial-dashboard-data';
import { resolvePortal } from '@/app/admin/portal-access';

export default async function SuperAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, portal } = await resolvePortal('super');

  // Prefetched here rather than in page.tsx - see the matching comment in
  // src/app/admin/layout.tsx for why (page.tsx re-renders per ?tab= click).
  const initialData = await getInitialAdminDashboardData(supabase);

  return (
    <AdminDashboardDataProvider data={initialData}>
      <AdminLayoutClient basePath="/super-admin/dashboard" loginPath="/super-admin" portalLabel="Super Admin" portal={portal} activeModule="perdiem">
        {children}
      </AdminLayoutClient>
    </AdminDashboardDataProvider>
  );
}
