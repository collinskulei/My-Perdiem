/**
 * @file Refunds module dashboard (<portal>/funding?tab=...). Scope is one
 * client - fixed in a client portal, picked from the clients with the
 * module on in the Super/Master portals. All of the client's refund
 * payments are loaded once (getFundingReceipts); both tabs work from that
 * list. A record of payments only - not reconciled against other modules.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as supabaseDb from "@/lib/supabase/database";
import { getClientModules } from "@/lib/supabase/modules";
import { getFundingReceipts, type FundingReceipt } from "@/lib/supabase/funding";
import { homePath, modulePath } from "@/lib/modules";
import type { Client } from "@/lib/data";
import { useAdminTab } from "../admin-tab-context";
import { usePortal } from "../portal-context";
import { InsightsLoadingSkeleton } from "../insights/shared";
import { isSuperAdminTier } from "../salary/salary-sidebar-navigation";
import { FUNDING_TABS } from "./funding-sidebar-navigation";
import { FundingOverview } from "./funding-overview";
import { FundingPayments } from "./funding-payments";

export function FundingDashboard({ currentTab }: { currentTab: string }) {
  const portal = usePortal();
  const { activeTab, setActiveTab } = useAdminTab();
  const crossClient = !!portal && portal.kind !== "client";
  const canDelete = isSuperAdminTier(portal?.tier);

  // Browser back/forward and direct URL visits - same sync as AdminDashboard.
  useEffect(() => {
    setActiveTab(currentTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  const [clients, setClients] = useState<Client[] | null>(null);
  const [clientId, setClientId] = useState<string | null>(portal?.clientId ?? null);
  const [receipts, setReceipts] = useState<FundingReceipt[] | null | undefined>(undefined);

  // Super/Master portals: only clients with the funding module switched on.
  useEffect(() => {
    if (!crossClient) return;
    Promise.all([supabaseDb.getClients(), getClientModules()]).then(([all, modules]) => {
      const on = new Set((modules ?? []).filter((m) => m.moduleKey === "funding" && m.enabled).map((m) => m.clientId));
      const list = all.filter((c) => on.has(c.id));
      setClients(list);
      setClientId((prev) => prev ?? list[0]?.id ?? null);
    });
  }, [crossClient]);

  const load = useCallback(() => {
    if (!clientId) return;
    getFundingReceipts(clientId).then(setReceipts);
  }, [clientId]);

  useEffect(() => {
    setReceipts(undefined);
    load();
  }, [load]);

  const client = crossClient ? clients?.find((c) => c.id === clientId) ?? null : null;
  const clientName = portal?.clientName ?? client?.name ?? "";

  const tab = FUNDING_TABS.some((t) => t.key === activeTab) ? activeTab : "overview";
  const basePath = portal ? modulePath(portal.base, "funding") : "";
  const goTo = (t: string) => {
    setActiveTab(t);
    window.history.replaceState(null, "", t === "overview" ? basePath : `${basePath}?tab=${t}`);
  };

  if (crossClient && clients === null) return <InsightsLoadingSkeleton />;

  if (crossClient && clients!.length === 0) {
    return (
      <Alert>
        <AlertTitle>No client has Refunds yet</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Switch the module on for a client from the Clients tab (Modules section on the client&apos;s card).</p>
          {portal && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`${homePath(portal.base)}?tab=clients`}>Go to Clients</Link>
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const tabLabel = FUNDING_TABS.find((t) => t.key === tab)?.label;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Refunds</h2>
          <p className="text-muted-foreground">{clientName ? `${clientName} · ` : ""}{tabLabel}</p>
        </div>
        {crossClient && clients && (
          <div className="space-y-1">
            <Label>Client</Label>
            <Select value={clientId ?? undefined} onValueChange={setClientId}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Choose client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!clientId ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : receipts === undefined ? (
        <InsightsLoadingSkeleton />
      ) : receipts === null ? (
        <Alert variant="destructive">
          <AlertTitle>Refund payments couldn&apos;t be loaded</AlertTitle>
          <AlertDescription>
            If this is a new setup, the 0037_funding_receipts.sql migration may not be applied yet.{" "}
            {portal && <Link className="underline" href={homePath(portal.base)}>Back to Home</Link>}
          </AlertDescription>
        </Alert>
      ) : tab === "payments" ? (
        <FundingPayments clientId={clientId} clientName={clientName} receipts={receipts} canDelete={canDelete} onChanged={load} />
      ) : (
        <FundingOverview payments={receipts} onAdd={() => goTo("payments")} />
      )}
    </div>
  );
}
