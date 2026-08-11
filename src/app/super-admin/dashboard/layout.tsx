/**
 * @file Guards the Super Admin dashboard: every request here is checked
 * server-side, same pattern as src/app/admin/layout.tsx. No session, or a
 * session whose participant row isn't access_tier = 'super_admin', bounces
 * back to the Super Admin login page (not the generic '/').
 */
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminLayoutClient } from '@/app/admin/admin-layout';

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

  if (!participant || participant.access_tier !== 'super_admin') {
    redirect('/super-admin');
  }

  return (
    <AdminLayoutClient basePath="/super-admin/dashboard" loginPath="/super-admin" portalLabel="Super Admin">
      {children}
    </AdminLayoutClient>
  );
}
