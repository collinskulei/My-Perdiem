/**
 * @file Server-side guard + context for the admin portals (/super-admin,
 * /master-admin, /<slug>-admin), shared by every module's layout - the
 * Per Diem dashboard, Salary Payments and the Home page - so all of them
 * enforce exactly the same access rules. Every request is checked here;
 * anything that fails bounces to that portal's own login page (never a
 * different client's portal, never the generic '/').
 *
 * Rules per portal:
 * - super:  access_tier = 'super_admin'.
 * - master: access_tier = 'master_admin'.
 * - client: access_tier = 'client_admin' whose client's slug matches the
 *   URL's [clientSlug].
 *
 * Exceptions:
 * - super_admin may open any client portal **permanently** - requested
 *   directly, so the Clients tab's "Dashboard" button
 *   (admin-clients-overview.tsx) can take a Super Admin into any client's
 *   dashboard exactly as that client's own Organization Admin sees it. Do
 *   not remove this when the temporary bypass below is revoked.
 * - master_admin may open the super and client portals as a TEMPORARY
 *   testing exception (see the matching note in
 *   src/components/admin-login-form.tsx) - revoke before launch by
 *   dropping the two `TEMP_MASTER_BYPASS` uses below.
 */
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEnabledModulesForClient } from '@/lib/supabase/modules';
import { MODULE_KEYS, homePath, type ModuleKey } from '@/lib/modules';
import type { AccessTier } from '@/lib/data';

export type PortalKind = 'super' | 'master' | 'client';

/** Serializable - passed from the server layout into PortalProvider. */
export type PortalInfo = {
  kind: PortalKind;
  /** '/super-admin', '/master-admin' or '/<slug>-admin'. */
  base: string;
  loginPath: string;
  label: string;
  tier: AccessTier;
  /** Set for client portals only - super/master portals are cross-client. */
  clientId: string | null;
  clientName: string | null;
  clientSlug: string | null;
  /** Client portal: that client's enabled modules. Super/master: every
   * module (their module dashboards span all clients). */
  enabledModules: ModuleKey[];
};

const TEMP_MASTER_BYPASS = true;

export async function resolvePortal(
  kind: PortalKind,
  clientSlug?: string
): Promise<{ supabase: SupabaseClient; portal: PortalInfo }> {
  const base = kind === 'client' ? `/${clientSlug}-admin` : kind === 'super' ? '/super-admin' : '/master-admin';
  const loginPath = base;
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

  const tier = participant?.access_tier as AccessTier | undefined;

  if (kind === 'master') {
    if (tier !== 'master_admin') redirect(loginPath);
    return {
      supabase,
      portal: { kind, base, loginPath, label: 'Master Admin', tier, clientId: null, clientName: null, clientSlug: null, enabledModules: MODULE_KEYS },
    };
  }

  if (kind === 'super') {
    if (!tier || (tier !== 'super_admin' && !(TEMP_MASTER_BYPASS && tier === 'master_admin'))) redirect(loginPath);
    return {
      supabase,
      portal: { kind, base, loginPath, label: 'Super Admin', tier, clientId: null, clientName: null, clientSlug: null, enabledModules: MODULE_KEYS },
    };
  }

  if (!tier || (
    tier !== 'client_admin' &&
    tier !== 'super_admin' &&
    !(TEMP_MASTER_BYPASS && tier === 'master_admin')
  )) {
    redirect(loginPath);
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, slug')
    .eq('slug', clientSlug)
    .maybeSingle();

  if (!client) {
    redirect(loginPath);
  }

  if (tier === 'client_admin' && participant?.client_id !== client.id) {
    redirect(loginPath);
  }

  return {
    supabase,
    portal: {
      kind,
      base,
      loginPath,
      label: 'Organization Admin',
      tier,
      clientId: client.id,
      clientName: client.name,
      clientSlug: client.slug,
      enabledModules: await getEnabledModulesForClient(client.id, supabase),
    },
  };
}

/** Sends the visitor to the portal's Home page when this module isn't
 * switched on for the client they're viewing. */
export function requireModule(portal: PortalInfo, key: ModuleKey): void {
  if (!portal.enabledModules.includes(key)) {
    redirect(homePath(portal.base));
  }
}
