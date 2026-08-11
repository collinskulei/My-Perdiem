/**
 * @file Guards the Master Admin dashboard: every request here is checked
 * server-side, same pattern as src/app/admin/layout.tsx. No session, or a
 * session whose participant row isn't access_tier = 'master_admin', bounces
 * back to the Master Admin login page (not the generic '/').
 */
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminLayoutClient } from '@/app/admin/admin-layout';

export default async function MasterAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/master-admin');
  }

  const { data: participant } = await supabase
    .from('participants')
    .select('access_tier')
    .eq('id', user.id)
    .single();

  if (!participant || participant.access_tier !== 'master_admin') {
    redirect('/master-admin');
  }

  return (
    <AdminLayoutClient basePath="/master-admin/dashboard" loginPath="/master-admin" portalLabel="Master Admin">
      {children}
    </AdminLayoutClient>
  );
}
