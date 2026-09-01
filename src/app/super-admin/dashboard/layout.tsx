/**
 * @file Guards the Super Admin dashboard: every request here is checked
 * server-side, same pattern as src/app/admin/layout.tsx. No session, or a
 * session whose participant row isn't access_tier = 'super_admin', bounces
 * back to the Super Admin login page (not the generic '/').
 * (TEMPORARY testing exception for master_admin - see inline comments.)
 */
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminLayoutClient } from '@/app/admin/admin-layout';
import { AdminDashboardDataProvider } from '@/app/admin/admin-dashboard-data-context';
import { getInitialAdminDashboardData } from '@/app/admin/get-initial-dashboard-data';

export default async function SuperAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/super-admin');
  }

  const { data: participant } = await supabase
    .from('participants')
    .select('access_tier')
    .eq('id', user.id)
    .single();

  // TEMPORARY (testing only, revoke before launch): master_admin is also let
  // through so one account can exercise every portal - see the matching
  // note in src/components/admin-login-form.tsx. To revoke, drop the
  // `&& participant.access_tier !== 'master_admin'` clause below.
  if (!participant || (participant.access_tier !== 'super_admin' && participant.access_tier !== 'master_admin')) {
    redirect('/super-admin');
  }

  // Prefetched here rather than in page.tsx - see the matching comment in
  // src/app/admin/layout.tsx for why (page.tsx re-renders per ?tab= click).
  const initialData = await getInitialAdminDashboardData(supabase);

  return (
    <AdminDashboardDataProvider data={initialData}>
      <AdminLayoutClient basePath="/super-admin/dashboard" loginPath="/super-admin" portalLabel="Super Admin">
        {children}
      </AdminLayoutClient>
    </AdminDashboardDataProvider>
  );
}
