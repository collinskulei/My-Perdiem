/**
 * @file Salary Payments module dashboard (<portal>/salary?tab=...). Scope is
 * one client - fixed in a client portal, picked from the clients with the
 * module on in the Super/Master portals - and either all of its employers
 * or one. Overview / Monthly Runs / Statutory work across employers;
 * Employees / Upload need a single employer (auto-picked when there's
 * only one). Tabs switch instantly via the shared tab context, like the
 * Per Diem dashboard (admin-tab-context.tsx).
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
import { getSalaryEmployers, getSalaryRunSummaries, type SalaryEmployer, type SalaryRunSummary } from "@/lib/supabase/salary";
import { homePath, modulePath } from "@/lib/modules";
import type { Client } from "@/lib/data";
import { useAdminTab } from "../admin-tab-context";
import { usePortal } from "../portal-context";
import { InsightsLoadingSkeleton } from "../insights/shared";
import { SALARY_TABS, isSuperAdminTier } from "./salary-sidebar-navigation";
import { SalaryOverview } from "./salary-overview";
import { SalaryRuns } from "./salary-runs";
import { SalaryEmployees } from "./salary-employees";
import { SalaryStatutory } from "./salary-statutory";
import { SalaryUpload } from "./salary-upload";
import { SalarySetup } from "./salary-setup";

const ALL = "__all__";

export function SalaryDashboard({ currentTab }: { currentTab: string }) {
  const portal = usePortal();
  const { activeTab, setActiveTab } = useAdminTab();
  const crossClient = !!portal && portal.kind !== "client";
  const canSetup = isSuperAdminTier(portal?.tier);

  // Browser back/forward and direct URL visits - same sync as AdminDashboard.
  useEffect(() => {
    setActiveTab(currentTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  const [clients, setClients] = useState<Client[] | null>(null);
  const [clientId, setClientId] = useState<string | null>(portal?.clientId ?? null);
  const [employers, setEmployers] = useState<SalaryEmployer[] | null>(null);
  const [employerId, setEmployerId] = useState<string>(ALL);
  const [summaries, setSummaries] = useState<SalaryRunSummary[] | null | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  // Super/Master portals: only clients with the salary module switched on.
  useEffect(() => {
    if (!crossClient) return;
    Promise.all([supabaseDb.getClients(), getClientModules()]).then(([all, modules]) => {
      const on = new Set((modules ?? []).filter((m) => m.moduleKey === "salary" && m.enabled).map((m) => m.clientId));
      const list = all.filter((c) => on.has(c.id));
      setClients(list);
      setClientId((prev) => prev ?? list[0]?.id ?? null);
    });
  }, [crossClient]);

  const loadEmployers = useCallback(() => {
    if (!clientId) return;
    getSalaryEmployers(clientId).then((list) => {
      setEmployers(list);
      setEmployerId((prev) => (prev !== ALL && !list.some((e) => e.id === prev) ? ALL : prev));
    });
  }, [clientId]);

  useEffect(() => {
    setEmployers(null);
    setEmployerId(ALL);
    loadEmployers();
  }, [loadEmployers]);

  const loadSummaries = useCallback(() => {
    if (!clientId) return;
    getSalaryRunSummaries(clientId, employerId === ALL ? null : employerId).then(setSummaries);
  }, [clientId, employerId]);

  useEffect(() => {
    setSummaries(undefined);
    loadSummaries();
  }, [loadSummaries]);

  const refresh = () => {
    loadSummaries();
    setRefreshKey((k) => k + 1);
  };

  const client = crossClient ? clients?.find((c) => c.id === clientId) ?? null : null;
  const clientName = portal?.clientName ?? client?.name ?? "";
  const singleEmployer = useMemo(() => {
    if (!employers) return null;
    if (employerId !== ALL) return employers.find((e) => e.id === employerId) ?? null;
    return employers.length === 1 ? employers[0] : null;
  }, [employers, employerId]);

  const tab = SALARY_TABS.some((t) => t.key === activeTab) && (activeTab !== "setup" || canSetup) ? activeTab : "overview";
  const basePath = portal ? modulePath(portal.base, "salary") : "";
  const goTo = (t: string) => {
    setActiveTab(t);
    window.history.replaceState(null, "", t === "overview" ? basePath : `${basePath}?tab=${t}`);
  };

  if (crossClient && clients === null) return <InsightsLoadingSkeleton />;

  if (crossClient && clients!.length === 0) {
    return (
      <Alert>
        <AlertTitle>No client has Salary Payments yet</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Switch the module on for a client from the Clients tab (Modules section on the client&apos;s card).</p>
          {portal && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`${modulePath(portal.base, "perdiem")}?tab=clients`}>Go to Clients</Link>
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const tabLabel = SALARY_TABS.find((t) => t.key === tab)?.label;
  const needsEmployer = tab === "employees" || tab === "upload";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Salary Payments</h2>
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
          {employers && employers.length > 0 && tab !== "setup" && (
            <div className="space-y-1">
              <Label>Employer</Label>
              <Select value={employerId} onValueChange={setEmployerId}>
                <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employers.length > 1 && <SelectItem value={ALL}>All employers</SelectItem>}
                  {employers.length === 1 && <SelectItem value={ALL}>{employers[0].name}</SelectItem>}
                  {employers.length > 1 && employers.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {!clientId || employers === null ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : tab === "setup" ? (
        <SalarySetup clientId={clientId} clientName={clientName} employers={employers} onChanged={() => { loadEmployers(); refresh(); }} />
      ) : employers.length === 0 ? (
        <Alert>
          <AlertTitle>No employers set up for {clientName}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Salary data is recorded per employer (e.g. Digital Health Agency), each with its own muster-roll template.</p>
            {canSetup ? (
              <Button size="sm" variant="outline" onClick={() => goTo("setup")}>Set up an employer</Button>
            ) : (
              <p>Ask your Super Admin to set one up.</p>
            )}
          </AlertDescription>
        </Alert>
      ) : needsEmployer && !singleEmployer ? (
        <Alert>
          <AlertTitle>Choose an employer</AlertTitle>
          <AlertDescription>{tabLabel} works on one employer at a time - pick one above.</AlertDescription>
        </Alert>
      ) : tab === "upload" ? (
        <SalaryUpload
          employer={singleEmployer!}
          existingRuns={summaries ?? []}
          canSetup={canSetup}
          onImported={refresh}
          onOpenSetup={() => goTo("setup")}
        />
      ) : tab === "employees" ? (
        <SalaryEmployees employer={singleEmployer!} refreshKey={refreshKey} />
      ) : summaries === undefined ? (
        <InsightsLoadingSkeleton />
      ) : summaries === null ? (
        <Alert variant="destructive">
          <AlertTitle>Salary data couldn&apos;t be loaded</AlertTitle>
          <AlertDescription>
            If this is a new setup, the 0031_salary_payments.sql migration may not be applied yet.{" "}
            {portal && <Link className="underline" href={homePath(portal.base)}>Back to Home</Link>}
          </AlertDescription>
        </Alert>
      ) : tab === "runs" ? (
        <SalaryRuns summaries={summaries} canDelete={canSetup} onChanged={refresh} />
      ) : tab === "statutory" ? (
        <SalaryStatutory summaries={summaries} />
      ) : (
        <SalaryOverview summaries={summaries} />
      )}
    </div>
  );
}
