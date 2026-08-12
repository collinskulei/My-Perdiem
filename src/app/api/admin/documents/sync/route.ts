/**
 * @file Syncs a client's OneDrive submission folder into the `documents`
 * table (see docs/MILESTONE_HANDOFF.md's Milestone 5 section). This is the
 * only way a `documents` row is ever created - a submission must correspond
 * to a real file Microsoft Graph reported, never something a client
 * fabricates directly, so this uses the service-role client for the
 * upsert (mirrors src/app/api/admin/invite-admin/route.ts's shape:
 * authenticate with the request-scoped client, authorize manually per-tier,
 * only then drop to the privileged client for the actual write).
 *
 * Authorization: Master/Super Admin may sync any client; Client Admin may
 * only sync their own client - clientId from the request body is ignored/
 * overridden for them, never trusted, same pattern as invite-admin.
 */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-server';
import { listFolderChildren } from '@/lib/microsoft/graph';

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

  let body: { clientId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const clientId = caller.access_tier === 'client_admin' ? caller.client_id : body.clientId ?? null;

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, onedrive_drive_id, onedrive_folder_id')
    .eq('id', clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 400 });
  }
  if (!client.onedrive_drive_id || !client.onedrive_folder_id) {
    return NextResponse.json({ error: 'This client has no OneDrive folder configured yet' }, { status: 400 });
  }

  let files;
  try {
    files = await listFolderChildren(client.onedrive_drive_id, client.onedrive_folder_id);
  } catch (error: any) {
    return NextResponse.json({ error: `Could not list OneDrive folder: ${error.message}` }, { status: 502 });
  }

  const admin = createSupabaseAdminClient();

  // Upsert per file rather than a bulk upsert so an existing row's status
  // (processing/done) is never touched - only first_seen_at-relevant fields
  // are meant to change on conflict, and Postgres upsert can't selectively
  // skip columns per-row, so each file gets its own conflict-aware write.
  for (const file of files) {
    const { data: existing } = await admin
      .from('documents')
      .select('id')
      .eq('client_id', clientId)
      .eq('onedrive_item_id', file.id)
      .maybeSingle();

    if (existing) {
      await admin
        .from('documents')
        .update({
          onedrive_file_name: file.name,
          onedrive_web_url: file.webUrl,
          onedrive_modified_at: file.lastModifiedDateTime,
        })
        .eq('id', existing.id);
    } else {
      await admin.from('documents').insert({
        client_id: clientId,
        onedrive_item_id: file.id,
        onedrive_file_name: file.name,
        onedrive_web_url: file.webUrl,
        onedrive_modified_at: file.lastModifiedDateTime,
        status: 'submitted',
      });
    }
  }

  return NextResponse.json({ success: true, count: files.length });
}
