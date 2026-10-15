/**
 * @file Travel & Ground Transfers dashboard (<portal>/travel?tab=...), a
 * submodule of Other Project Facilitations. Scope is one client - fixed
 * in a client portal, picked from the clients with the module on in the
 * Super/Master portals - and optionally one year (by payment date). All
 * of the client's payments are loaded once (getTravelPayments) and every
 * tab works from that list. Tabs switch
 * instantly via the shared tab context, like the Salary dashboard.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as supabaseDb from "@/lib/supabase/database";
import { getClientModules } from "@/lib/supabase/modules";
import { getTravelPayments, type TravelPayment } from "@/lib/supabase/travel";
import { GROUPS, groupPath, homePath, modulePath } from "@/lib/modules";
import type { Client } from "@/lib/data";
import { useAdminTab } from "../admin-tab-context";
import { usePortal } from "../portal-context";
import { InsightsLoadingSkeleton } from "../insights/shared";
import { isSuperAdminTier } from "../salary/salary-sidebar-navigation";
import { TRAVEL_TABS } from "./travel-sidebar-navigation";
import { TravelOverview } from "./travel-overview";
import { TravelPayments } from "./travel-payments";
import { TravelUpload } from "./travel-upload";

const ALL_YEARS = "__all__";

export function TravelDashboard({ currentTab }: { currentTab: string }) {
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
  const [payments, setPayments] = useState<TravelPayment[] | null | undefined>(undefined);
  const [year, setYear] = useState<string>(ALL_YEARS);

  // Super/Master portals: only clients with the travel module switched on.
  useEffect(() => {
    if (!crossClient) return;
    Promise.all([supabaseDb.getClients(), getClientModules()]).then(([all, modules]) => {
      const on = new Set((modules ?? []).filter((m) => m.moduleKey === "travel" && m.enabled).map((m) => m.clientId));
      const list = all.filter((c) => on.has(c.id));
      setClients(list);
      setClientId((prev) => prev ?? list[0]?.id ?? null);
    });
  }, [crossClient]);

  const load = useCallback(() => {
    if (!clientId) return;
    getTravelPayments(clientId).then(setPayments);
  }, [clientId]);

  useEffect(() => {
    setPayments(undefined);
    setYear(ALL_YEARS);
    load();
  }, [load]);

  const years = useMemo(
    () => Array.from(new Set((payments ?? []).map((p) => p.paymentDate.slice(0, 4)))).sort().reverse(),
    [payments]
  );
  const shown = useMemo(
    () => (payments ?? []).filter((p) => year === ALL_YEARS || p.paymentDate.startsWith(year)),
    [payments, year]
  );

  const client = crossClient ? clients?.find((c) => c.id === clientId) ?? null : null;
  const clientName = portal?.clientName ?? client?.name ?? "";

  const tab = TRAVEL_TABS.some((t) => t.key === activeTab && (!("superAdminOnly" in t) || canDelete)) ? activeTab : "overview";
  const basePath = portal ? modulePath(portal.base, "travel") : "";
  const goTo = (t: string) => {
    setActiveTab(t);
    window.history.replaceState(null, "", t === "overview" ? basePath : `${basePath}?tab=${t}`);
  };

  if (crossClient && clients === null) return <InsightsLoadingSkeleton />;

  if (crossClient && clients!.length === 0) {
    return (
      <Alert>
        <AlertTitle>No client has Travel &amp; Ground Transfers yet</AlertTitle>
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

  const tabLabel = TRAVEL_TABS.find((t) => t.key === tab)?.label;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {portal && (
            <Link href={groupPath(portal.base, "facilitations")} className="text-sm text-muted-foreground hover:underline">
              {GROUPS.facilitations.label}
            </Link>
          )}
          <h2 className="text-2xl font-bold tracking-tight">Travel &amp; Ground Transfers</h2>
          <p className="text-muted-foreground">{clientName ? `${clientName} · ` : ""}{tabLabel}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
          {tab !== "upload" && years.length > 1 && (
            <div className="space-y-1">
              <Label>Year paid</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_YEARS}>All years</SelectItem>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {!clientId ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : payments === undefined ? (
        <InsightsLoadingSkeleton />
      ) : payments === null ? (
        <Alert variant="destructive">
          <AlertTitle>Travel payments couldn&apos;t be loaded</AlertTitle>
          <AlertDescription>
            If this is a new setup, the 0038_travel_payments.sql migration may not be applied yet.{" "}
            {portal && <Link className="underline" href={homePath(portal.base)}>Back to Home</Link>}
          </AlertDescription>
        </Alert>
      ) : tab === "upload" ? (
        <TravelUpload clientId={clientId} existing={payments} canDelete={canDelete} onImported={load} onViewPayments={() => goTo("payments")} />
      ) : tab === "payments" ? (
        <TravelPayments clientId={clientId} clientName={clientName} payments={shown} canDelete={canDelete} onChanged={load} />
      ) : (
        <TravelOverview payments={shown} onUpload={canDelete ? () => goTo("upload") : undefined} />
      )}
    </div>
  );
}
