/**
 * @file Client Admin's dedicated login portal. Reachable both directly at
 * /client-admin/<slug> and via the pretty /<slug>-admin rewrite in
 * src/middleware.ts (Next.js can't mix literal text with a dynamic segment
 * in one folder name, so the rewrite is what makes /<slug>-admin work).
 * Access control doesn't depend on which URL was used to get here.
 */
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminLoginForm } from "@/components/admin-login-form";
import * as supabaseDb from "@/lib/supabase/database";

export default function ClientAdminLoginPage({ params }: { params: { clientSlug: string } }) {
  const [client, setClient] = useState<{ id: string; name: string } | null | undefined>(undefined);

  useEffect(() => {
    supabaseDb.getClientBySlug(params.clientSlug).then(setClient);
  }, [params.clientSlug]);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      {client === undefined ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : client === null ? (
        <p className="text-muted-foreground">This admin portal doesn&apos;t exist.</p>
      ) : (
        <AdminLoginForm
          title={client.name}
          description={`Sign in to manage ${client.name}'s dashboard.`}
          expectedTier="client_admin"
          expectedClientId={client.id}
          redirectTo={`/${params.clientSlug}-admin/dashboard`}
        />
      )}
    </div>
  );
}
