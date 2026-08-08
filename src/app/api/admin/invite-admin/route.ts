/**
 * @file Invites a new Super Admin, Client Admin, or Client User (participant)
 * by email. This is the server-side-only Supabase code in the app: creating
 * an auth user before they've ever logged in requires
 * supabase.auth.admin.inviteUserByEmail(), which only works with the
 * service-role key.
 *
 * Authorization mirrors set_access_tier()'s hierarchy (see
 * 0003_tenancy_and_tiers.sql / 0005_admin_delegation_and_deactivation.sql):
 *   - Master Admin may invite any tier.
 *   - Super Admin may invite Client Admin or Client User, for any client.
 *   - Client Admin may invite Client Admin or Client User, for their OWN
 *     client only (clientId is forced, not trusted from the request body).
 *   - Client User cannot invite anyone.
 */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-server';

type InviteBody = {
  email?: string;
  name?: string;
  tier?: 'super_admin' | 'client_admin' | 'client_user';
  clientId?: string;
};

const DESIGNATIONS: Record<string, string> = {
  super_admin: 'Super Admin',
  client_admin: 'Client Admin',
  client_user: 'Participant',
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from('participants')
    .select('access_tier, client_id')
    .eq('id', user.id)
    .single();

  if (!caller || caller.access_tier === 'client_user') {
    return NextResponse.json({ error: 'Insufficient privileges' }, { status: 403 });
  }

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, name, tier } = body;

  if (!email || !name || !tier || !(tier in DESIGNATIONS)) {
    return NextResponse.json(
      { error: 'email, name, and tier ("super_admin", "client_admin", or "client_user") are required' },
      { status: 400 }
    );
  }

  if (tier === 'super_admin' && caller.access_tier !== 'master_admin') {
    return NextResponse.json({ error: 'Only Master Admin can invite a Super Admin' }, { status: 403 });
  }

  // Resolve which client this invite is scoped to. Client Admins can only
  // ever invite for their own client - clientId from the request body is
  // ignored for them, never trusted.
  let clientId: string | null = null;
  if (tier === 'client_admin' || tier === 'client_user') {
    if (caller.access_tier === 'client_admin') {
      clientId = caller.client_id;
    } else {
      clientId = body.clientId ?? null;
    }

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required for this invite' }, { status: 400 });
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, archived_at')
      .eq('id', clientId)
      .maybeSingle();
    if (!client || client.archived_at) {
      return NextResponse.json({ error: 'Client not found' }, { status: 400 });
    }
  }

  const admin = createSupabaseAdminClient();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${new URL(request.url).origin}/reset-password`,
  });

  if (inviteError || !invited?.user) {
    return NextResponse.json({ error: inviteError?.message ?? 'Could not send invite' }, { status: 400 });
  }

  const { error: insertError } = await admin.from('participants').insert({
    id: invited.user.id,
    name,
    email,
    designation: DESIGNATIONS[tier],
    access_tier: tier,
    client_id: clientId,
    avatar_url: `https://picsum.photos/seed/${invited.user.id}/100/100`,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId: invited.user.id });
}
