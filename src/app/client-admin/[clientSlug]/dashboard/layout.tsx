/**
 * @file Guards a client's Per Diem Payments dashboard: every request here is
 * checked server-side by resolvePortal() (portal-access.ts). A session that
 * isn't this client's own Organization Admin bounces back to this client's
 * own login page - never to a different client's portal. Super Admins may
 * open any client's dashboard permanently (so the Clients tab's
 * "Dashboard" button works); the master_admin pass-through is a TEMPORARY
 * testing exception - both are documented in portal-access.ts.
 *
 * If the client doesn't have the Per Diem Payments module switched on,
 * this redirects to the portal's Home page instead.
 */
import { AdminLayoutClient } from '@/app/admin/admin-layout';
import { AdminDashboardDataProvider } from '@/app/admin/admin-dashboard-data-context';
import { getInitialAdminDashboardData } from '@/app/admin/get-initial-dashboard-data';
import { resolvePortal, requireModule } from '@/app/admin/portal-access';

export default async function ClientAdminDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  const { supabase, portal } = await resolvePortal('client', clientSlug);
  requireModule(portal, 'perdiem');

  // Prefetched here rather than in page.tsx - see the matching comment in
  // src/app/admin/layout.tsx for why (page.tsx re-renders per ?tab= click).
  const initialData = await getInitialAdminDashboardData(supabase);

  return (
    <AdminDashboardDataProvider data={initialData}>
      <AdminLayoutClient
        basePath={`/${clientSlug}-admin/dashboard`}
        loginPath={portal.loginPath}
        portalLabel="Organization Admin"
        portal={portal}
        activeModule="perdiem"
      >
        {children}
      </AdminLayoutClient>
    </AdminDashboardDataProvider>
  );
}
