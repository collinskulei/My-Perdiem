/**
 * @file Deactivates or reactivates a participant. Unlike a cosmetic flag,
 * this actually blocks sign-in via a Supabase Auth ban - a disabled account
 * can't be used even with a cached/valid JWT once its current access token
 * expires (max 1 hour). The `disabled_at` column is set in the same call so
 * the two never drift apart (both are written with the service-role client;
 * direct writes to `disabled_at` are blocked by the same trigger that
 * guards access_tier/client_id - see 0005_admin_delegation_and_deactivation.sql).
 *
 * Scope: Client Admins may only deactivate Client Users at their own client
 * (never a peer Client Admin - that's set_access_tier()'s demote path
 * instead). Master/Super Admin may deactivate Client Admin or Client User at
 * any client. Nobody can target Master Admin/Super Admin via this route.
 */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: targetId } = await params;

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

  let body: { disabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (typeof body.disabled !== 'boolean') {
    return NextResponse.json({ error: '"disabled" (boolean) is required' }, { status: 400 });
  }

  // Read via the caller's own session, not the service-role client, so RLS
  // ("Read participants in scope") is the first line of defense on visibility.
  const { data: target } = await supabase
    .from('participants')
    .select('id, access_tier, client_id')
    .eq('id', targetId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  if (target.access_tier === 'master_admin' || target.access_tier === 'super_admin') {
    return NextResponse.json({ error: 'Cannot deactivate a Master/Super Admin account' }, { status: 403 });
  }

  if (caller.access_tier === 'client_admin') {
    if (target.access_tier !== 'client_user' || target.client_id !== caller.client_id) {
      return NextResponse.json(
        { error: 'Client Admins may only deactivate Client Users at their own client' },
        { status: 403 }
      );
    }
  }
  // master_admin / super_admin: any client_admin or client_user, any client.

  const admin = createSupabaseAdminClient();

  const { error: banError } = await admin.auth.admin.updateUserById(targetId, {
    ban_duration: body.disabled ? '876000h' : 'none',
  });
  if (banError) {
    return NextResponse.json({ error: banError.message }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from('participants')
    .update({ disabled_at: body.disabled ? new Date().toISOString() : null })
    .eq('id', targetId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
