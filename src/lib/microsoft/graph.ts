/**
 * @file Read-only Microsoft Graph client for the OneDrive submission inbox
 * (see docs/MILESTONE_HANDOFF.md's Milestone 5 section). Uses the OAuth2
 * client-credentials grant - a single app-level identity, not a per-user
 * token - the same "one privileged service credential in .env" shape as
 * src/lib/supabase/admin-server.ts's SUPABASE_SERVICE_ROLE_KEY. Only ever
 * call this from Route Handlers, never from a Server Component that renders
 * based on user input, and never export it (or anything built from it) to
 * client code - the `server-only` import makes accidental client-bundle
 * inclusion a build error instead of a runtime credential leak.
 */
import "server-only";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

let cachedToken: { value: string; expiresAt: number } | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set - refusing to call Microsoft Graph without it.`);
  }
  return value;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const tenantId = getRequiredEnv("MICROSOFT_TENANT_ID");
  const clientId = getRequiredEnv("MICROSOFT_CLIENT_ID");
  const clientSecret = getRequiredEnv("MICROSOFT_CLIENT_SECRET");

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph token request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export type OneDriveFile = {
  id: string;
  name: string;
  webUrl: string | null;
  lastModifiedDateTime: string | null;
};

/**
 * Lists the immediate children of a OneDrive/SharePoint folder. `driveId`
 * identifies the drive (a user's OneDrive or a SharePoint site's document
 * library - both are "drives" in Graph API terms), `folderId` the specific
 * folder within it. Excludes subfolders - only files, since a submission is
 * always a single uploaded document, not a nested structure.
 */
export async function listFolderChildren(driveId: string, folderId: string): Promise<OneDriveFile[]> {
  const token = await getAccessToken();
  const response = await fetch(`${GRAPH_BASE_URL}/drives/${driveId}/items/${folderId}/children`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph list-folder request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    value: { id: string; name: string; webUrl?: string; lastModifiedDateTime?: string; folder?: unknown }[];
  };

  return data.value
    .filter((item) => !item.folder)
    .map((item) => ({
      id: item.id,
      name: item.name,
      webUrl: item.webUrl ?? null,
      lastModifiedDateTime: item.lastModifiedDateTime ?? null,
    }));
}
