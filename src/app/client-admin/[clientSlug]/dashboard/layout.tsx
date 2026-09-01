/**
 * @file Guards the Client Admin dashboard: every request here is checked
 * server-side, same pattern as src/app/admin/layout.tsx. No session, a
 * session that isn't access_tier = 'client_admin', or a client_id whose
 * slug doesn't match this URL's [clientSlug], all bounce back to this
 * client's own login page - never to a different client's portal.
 *
 * Two intentionally different exceptions to that rule:
 * - super_admin is let through **permanently** - requested directly, so a
 *   "Dashboard" button in the Clients tab widget
 *   (admin-clients-overview.tsx) can take a Super Admin into any client's
 *   dashboard exactly as that client's own Client Admin sees it. Do not
 *   remove this when the temporary bypass below is eventually revoked.
 * - master_admin is let through as a TEMPORARY testing exception (see
 *   inline comment) - revoke before launch.
 */
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminLayoutClient } from '@/app/admin/admin-layout';
import { AdminDashboardDataProvider } from '@/app/admin/admin-dashboard-data-context';
import { getInitialAdminDashboardData } from '@/app/admin/get-initial-dashboard-data';

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

  // Permanent: super_admin can view/manage any client's dashboard (see the
  // file comment above) - unconditional, like master_admin below, since a
  // Super Admin's own client_id is null and the whole point is to reach a
  // client that isn't theirs.
  //
  // TEMPORARY (testing only, revoke before launch): master_admin is also let
  // through, and skips the client-slug match below entirely (they have no
  // client_id) - see the matching note in
  // src/components/admin-login-form.tsx. To revoke, drop the
  // `&& participant.access_tier !== 'master_admin'` clause and the
  // `if (participant.access_tier === 'client_admin')` wrapper below (making
  // its contents unconditional again) - do NOT also drop the super_admin
  // clause, which is permanent, not part of this temporary exception.
  if (!participant || (
    participant.access_tier !== 'client_admin' &&
    participant.access_tier !== 'master_admin' &&
    participant.access_tier !== 'super_admin'
  )) {
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

  // Prefetched here rather than in page.tsx - see the matching comment in
  // src/app/admin/layout.tsx for why (page.tsx re-renders per ?tab= click).
  const initialData = await getInitialAdminDashboardData(supabase);

  return (
    <AdminDashboardDataProvider data={initialData}>
      <AdminLayoutClient
        basePath={`/${params.clientSlug}-admin/dashboard`}
        loginPath={loginPath}
        portalLabel="Client Admin"
      >
        {children}
      </AdminLayoutClient>
    </AdminDashboardDataProvider>
  );
}
