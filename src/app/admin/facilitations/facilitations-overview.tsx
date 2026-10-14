/**
 * @file Other Project Facilitations (<portal>/facilitations): the group's
 * landing page - one combined view of its submodules (Hotel Bookings,
 * Travel & Ground Transfers) with a way into each. Scope is one client,
 * like the submodule dashboards; only the submodules switched on for that
 * client are loaded and shown. Each submodule's own data access is used
 * as-is (getHotelPayments / getTravelPayments).
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ArrowRight, Loader2, Sigma } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatCurrencyWhole } from "@/lib/utils";
import * as supabaseDb from "@/lib/supabase/database";
import { getClientModules, type ClientModuleRow } from "@/lib/supabase/modules";
import { getHotelPayments } from "@/lib/supabase/hotels";
import { getTravelPayments } from "@/lib/supabase/travel";
import { GROUPS, MODULES, homePath, modulePath, type ModuleKey } from "@/lib/modules";
import type { Client } from "@/lib/data";
import { usePortal } from "../portal-context";
import { StatCard, ChartCard, EmptyState, InsightsLoadingSkeleton, glassTooltipStyle } from "../insights/shared";
import { shortCurrency } from "../hotels/hotels-shared";

const GROUP = GROUPS.facilitations;
const ALL_YEARS = "__all__";

/** One payment from any submodule, reduced to what this page needs. */
type Item = { module: ModuleKey; paymentDate: string; amount: number };

const LOADERS: Partial<Record<ModuleKey, (clientId: string) => Promise<Item[] | null>>> = {
  hotels: async (clientId) => (await getHotelPayments(clientId))?.map((p) => ({ module: "hotels" as const, paymentDate: p.paymentDate, amount: p.amount })) ?? null,
  travel: async (clientId) => (await getTravelPayments(clientId))?.map((p) => ({ module: "travel" as const, paymentDate: p.paymentDate, amount: p.amount })) ?? null,
};

export function FacilitationsOverview() {
  const portal = usePortal();
  const crossClient = !!portal && portal.kind !== "client";

  const [clients, setClients] = useState<Client[] | null>(null);
  const [moduleRows, setModuleRows] = useState<ClientModuleRow[] | null>(null);
  const [clientId, setClientId] = useState<string | null>(portal?.clientId ?? null);
  const [items, setItems] = useState<Item[] | undefined>(undefined);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [year, setYear] = useState<string>(ALL_YEARS);
  const chartRef = useRef<HTMLDivElement>(null);

  // Super/Master portals: clients with at least one submodule switched on.
  useEffect(() => {
    if (!crossClient) return;
    Promise.all([supabaseDb.getClients(), getClientModules()]).then(([all, rows]) => {
      const on = new Set((rows ?? []).filter((m) => m.enabled && GROUP.modules.includes(m.moduleKey)).map((m) => m.clientId));
      const list = all.filter((c) => on.has(c.id));
      setModuleRows(rows ?? []);
      setClients(list);
      setClientId((prev) => prev ?? list[0]?.id ?? null);
    });
  }, [crossClient]);

  const submodules: ModuleKey[] = useMemo(() => {
    if (!crossClient) return GROUP.modules.filter((m) => portal?.enabledModules.includes(m));
    return GROUP.modules.filter((m) => moduleRows?.some((r) => r.clientId === clientId && r.moduleKey === m && r.enabled));
  }, [crossClient, portal, moduleRows, clientId]);

  useEffect(() => {
    if (!clientId || submodules.length === 0) return;
    let cancelled = false;
    setItems(undefined);
    setYear(ALL_YEARS);
    Promise.all(submodules.map((m) => LOADERS[m]!(clientId))).then((results) => {
      if (cancelled) return;
      setFailed(submodules.filter((_, i) => results[i] === null));
      setItems(results.flatMap((r) => r ?? []));
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, submodules]);

  const years = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.paymentDate.slice(0, 4)))).sort().reverse(), [items]);
  const shown = useMemo(() => (items ?? []).filter((i) => year === ALL_YEARS || i.paymentDate.startsWith(year)), [items, year]);

  const data = useMemo(() => {
    const byModule = Object.fromEntries(submodules.map((m) => [m, { total: 0, payments: 0 }])) as Record<ModuleKey, { total: number; payments: number }>;
    const monthly = new Map<string, Record<string, number | string>>();
    for (const i of shown) {
      byModule[i.module].total += i.amount;
      byModule[i.module].payments += 1;
      const m = i.paymentDate.slice(0, 7);
      const bucket = monthly.get(m) ?? { month: m };
      bucket[i.module] = ((bucket[i.module] as number) ?? 0) + i.amount;
      monthly.set(m, bucket);
    }
    const trend = Array.from(monthly.values())
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((b) => ({ ...b, label: new Date(`${b.month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) }));
    return { byModule, trend, total: shown.reduce((acc, i) => acc + i.amount, 0) };
  }, [shown, submodules]);

  const client = crossClient ? clients?.find((c) => c.id === clientId) ?? null : null;
  const clientName = portal?.clientName ?? client?.name ?? "";
  const base = portal?.base ?? "";

  if (crossClient && clients === null) return <InsightsLoadingSkeleton />;

  if (crossClient && clients!.length === 0) {
    return (
      <Alert>
        <AlertTitle>No client has {GROUP.label} yet</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Switch Hotel Bookings or Travel &amp; Ground Transfers on for a client from the Clients tab (Modules section on the client&apos;s card).</p>
          {portal && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`${homePath(portal.base)}?tab=clients`}>Go to Clients</Link>
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{GROUP.label}</h2>
          <p className="text-muted-foreground">{clientName ? `${clientName} · ` : ""}Overview</p>
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
          {years.length > 1 && (
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
      ) : items === undefined ? (
        <InsightsLoadingSkeleton />
      ) : (
        <>
          {failed.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>Some payments couldn&apos;t be loaded</AlertTitle>
              <AlertDescription>
                {failed.map((m) => MODULES[m].label).join(", ")} - if this is a new setup, its database migration may not be applied yet.
              </AlertDescription>
            </Alert>
          )}

          <StatCard icon={Sigma} label={`Total ${GROUP.label}`} value={data.total} formatter={formatCurrencyWhole} />

          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            {submodules.map((key, i) => {
              const m = MODULES[key];
              const Icon = m.icon;
              const share = data.total > 0 ? Math.round((data.byModule[key].total / data.total) * 100) : 0;
              return (
                <Card key={key} className="flex flex-col animate-in fade-in-0 slide-in-from-bottom-4" style={{ animationDelay: `${50 * (i + 1)}ms` }}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{m.label}</CardTitle>
                      <CardDescription>{data.byModule[key].payments} payment{data.byModule[key].payments === 1 ? "" : "s"}</CardDescription>
                    </div>
                    <Icon className="h-5 w-5 shrink-0" />
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2">
                    <p className="text-2xl md:text-3xl font-bold tabular-nums truncate" style={{ color: m.color }}>
                      {formatCurrency(data.byModule[key].total)}
                    </p>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${share}%`, background: m.color }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{share}% of the total</p>
                  </CardContent>
                  <div className="px-6 pb-6">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={modulePath(base, key)}>
                        Open {m.label}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <ChartCard title="Paid by Month" chartRef={chartRef} filename="project-facilitations-by-month">
            {data.trend.length === 0 ? <EmptyState message="No payments on file yet." /> : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={shortCurrency} width={90} />
                  <Tooltip {...glassTooltipStyle} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                  <Legend />
                  {submodules.map((key, i) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={MODULES[key].label}
                      stackId="total"
                      fill={MODULES[key].color}
                      radius={i === submodules.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}
