/**
 * @file Thin fetch wrappers around the /api/admin/* Route Handlers. Never
 * talks to Supabase Auth admin APIs directly from the client - those require
 * the service-role key, which only ever lives in the API routes themselves.
 */

export async function inviteAdmin(payload: {
  email: string;
  name: string;
  tier: "super_admin" | "client_admin" | "client_user";
  clientId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/admin/invite-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    return { success: false, error: body.error ?? "Failed to send invite" };
  }
  return { success: true };
}

export async function setParticipantDisabled(
  participantId: string,
  disabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/admin/participants/${participantId}/set-disabled`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disabled }),
  });
  const body = await res.json();
  if (!res.ok) {
    return { success: false, error: body.error ?? "Failed to update participant" };
  }
  return { success: true };
}
