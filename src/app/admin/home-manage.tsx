/**
 * @file Super/Master Admin Home (<portal>/home?tab=...): the overall
 * Insights (portal-home.tsx) plus the platform-wide admin tabs - Manage,
 * Clients, Submissions - which live here rather than inside the Per Diem
 * module because they're about the whole platform, not one module. The
 * tabs reuse the Per Diem dashboard's own components; this only loads the
 * data they need (admins, clients, documents). Organization Admins keep
 * Manage/Profile in the Per Diem menu, so their Home is Insights only.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import * as supabaseDb from "@/lib/supabase/database";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { modulePath } from "@/lib/modules";
import type { Client, Document, Participant } from "@/lib/data";
import { useAdminTab } from "./admin-tab-context";
import { usePortal } from "./portal-context";
import { PortalHome } from "./portal-home";
import { AdminManagement } from "./admin-management";
import { AdminClientsOverview } from "./admin-clients-overview";
import { AdminSubmissionsTab } from "./admin-submissions-tab";
import { isHomeAdminTab } from "./home-sidebar-navigation";

const TAB_TITLE: Record<string, string> = { management: "Manage", clients: "Clients", submissions: "Submissions" };

function HomeAdminTabs({ tab }: { tab: string }) {
  const portal = usePortal();
  const { toast } = useToast();
  const [currentAdmin, setCurrentAdmin] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabaseDb.getParticipantById(user.id).then(setCurrentAdmin);
    });
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, d] = await Promise.all([supabaseDb.getParticipants(), supabaseDb.getClients(), supabaseDb.getDocuments()]);
      setParticipants(p);
      setClients(c);
      setDocuments(d);
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
      toast({ title: "Error", description: "Failed to load data from the database.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const perdiemPath = portal ? modulePath(portal.base, "perdiem") : "/admin";

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{TAB_TITLE[tab]}</h2>
      {!currentAdmin ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : tab === "management" ? (
        <AdminManagement currentAdmin={currentAdmin} participants={participants} onParticipantsChanged={fetchAll} />
      ) : tab === "clients" ? (
        <AdminClientsOverview clients={clients} participants={participants} basePath={perdiemPath} onChanged={fetchAll} loading={loading} />
      ) : (
        <AdminSubmissionsTab currentAdmin={currentAdmin} clients={clients} documents={documents} onChanged={fetchAll} />
      )}
    </div>
  );
}

export function HomeDashboard({ currentTab }: { currentTab: string }) {
  const { activeTab, setActiveTab } = useAdminTab();

  // Browser back/forward and direct URL visits - same sync as AdminDashboard.
  useEffect(() => {
    setActiveTab(currentTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  if (isHomeAdminTab(activeTab)) {
    return <HomeAdminTabs tab={activeTab} />;
  }
  return <PortalHome />;
}
