/**
 * @file Guards the Client Admin dashboard: every request here is checked
 * server-side, same pattern as src/app/admin/layout.tsx. No session, a
 * session that isn't access_tier = 'client_admin', or a client_id whose
 * slug doesn't match this URL's [clientSlug], all bounce back to this
 * client's own login page - never to a different client's portal.
 * (TEMPORARY testing exception for master_admin - see inline comments.)
 */
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminLayoutClient } from '@/app/admin/admin-layout';

export default async function ClientAdminDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { clientSlug: string };
}) {
  const loginPath = `/${params.clientSlug}-admin`;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(loginPath);
  }

  const { data: participant } = await supabase
    .from('participants')
    .select('access_tier, client_id')
    .eq('id', user.id)
    .single();

  // TEMPORARY (testing only, revoke before launch): master_admin is also let
  // through, and skips the client-slug match below entirely (they have no
  // client_id) - see the matching note in
  // src/components/admin-login-form.tsx. To revoke, drop the
  // `&& participant.access_tier !== 'master_admin'` clause and the
  // `if (participant.access_tier === 'client_admin')` wrapper below (making
  // its contents unconditional again).
  if (!participant || (participant.access_tier !== 'client_admin' && participant.access_tier !== 'master_admin')) {
    redirect(loginPath);
  }

  if (participant.access_tier === 'client_admin') {
    if (!participant.client_id) {
      redirect(loginPath);
    }

    const { data: client } = await supabase
      .from('clients')
      .select('slug')
      .eq('id', participant.client_id)
      .single();

    if (!client || client.slug !== params.clientSlug) {
      redirect(loginPath);
    }
  }

  return (
    <AdminLayoutClient
      basePath={`/${params.clientSlug}-admin/dashboard`}
      loginPath={loginPath}
      portalLabel="Client Admin"
    >
      {children}
    </AdminLayoutClient>
  );
}
