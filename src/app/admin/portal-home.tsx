/**
 * @file A portal's Home page (<portal>/home): the overall Insights across
 * every module, plus a way into each module's own dashboard.
 *
 *   Overall Total = the sum of every enabled module's headline amount
 *   Per Diem      = total paid out (same rule and figure as Per Diem's
 *                   own Insights "Total Paid Out")
 *   Salary        = salary cost: gross pay + employer contributions
 *
 * All numbers come from get_platform_totals (0031_salary_payments.sql), one
 * row per module x client x month; this only reshapes them. Super/Master
 * Admins see every client (with a client filter and a per-client table);
 * an Organization Admin sees only their own client.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format, startOfYear, subMonths, startOfMonth } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ArrowRight, Layers, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import * as supabaseDb from "@/lib/supabase/database";
import { getPlatformTotals, type PlatformTotalRow } from "@/lib/supabase/modules";
import { MODULES, MODULE_KEYS, modulePath, type ModuleKey } from "@/lib/modules";
import type { Client } from "@/lib/data";
import { usePortal } from "./portal-context";
import {
  StatCard, ChartCard, SectionHeader, EmptyState, InsightsLoadingSkeleton,
  glassTooltipStyle, downloadSectionAsPdf,
} from "./insights/shared";

type RangeKey = "all" | "ytd" | "12m" | "custom";

const ALL_CLIENTS = "__all__";

function rangeDates(key: RangeKey, customFrom: string, customTo: string): [string | null, string | null] {
  const today = new Date();
  if (key === "ytd") return [format(startOfYear(today), "yyyy-MM-dd"), format(today, "yyyy-MM-dd")];
  if (key === "12m") return [format(startOfMonth(subMonths(today, 11)), "yyyy-MM-dd"), format(today, "yyyy-MM-dd")];
  if (key === "custom") return [customFrom || null, customTo || null];
  return [null, null];
}

const MODULE_AMOUNT_LABEL: Record<ModuleKey, string> = {
  perdiem: "Total paid out",
  salary: "Salary cost (gross + employer contributions)",
};

export function PortalHome() {
  const portal = usePortal();
  const [range, setRange] = useState<RangeKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [clientFilter, setClientFilter] = useState<string>(ALL_CLIENTS);
  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<PlatformTotalRow[] | null | undefined>(undefined);

  const trendRef = useRef<HTMLDivElement>(null);
  const clientsRef = useRef<HTMLDivElement>(null);

  const crossClient = !!portal && portal.kind !== "client";
  const modules: ModuleKey[] = portal ? portal.enabledModules : MODULE_KEYS;
  const [dateFrom, dateTo] = rangeDates(range, customFrom, customTo);

  useEffect(() => {
    if (crossClient) supabaseDb.getClients().then(setClients);
  }, [crossClient]);

  const scopedClientId = portal?.clientId ?? (clientFilter === ALL_CLIENTS ? null : clientFilter);

  useEffect(() => {
    let cancelled = false;
    setRows(undefined);
    getPlatformTotals(scopedClientId, dateFrom, dateTo).then((r) => {
      if (!cancelled) setRows(r);
    });
    return () => {
      cancelled = true;
    };
  }, [scopedClientId, dateFrom, dateTo]);

  const data = useMemo(() => {
    const list = (rows ?? []).filter((r) => modules.includes(r.module));
    const byModule = Object.fromEntries(modules.map((m) => [m, 0])) as Record<ModuleKey, number>;
    const monthly = new Map<string, Record<string, number | string>>();
    const byClient = new Map<string, Record<ModuleKey, number>>();
    for (const r of list) {
      byModule[r.module] += r.amount;
      if (r.month) {
        const bucket = monthly.get(r.month) ?? { month: r.month };
        bucket[r.module] = ((bucket[r.module] as number) ?? 0) + r.amount;
        monthly.set(r.month, bucket);
      }
      const c = byClient.get(r.clientId) ?? (Object.fromEntries(modules.map((m) => [m, 0])) as Record<ModuleKey, number>);
      c[r.module] += r.amount;
      byClient.set(r.clientId, c);
    }
    const trend = Array.from(monthly.values())
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((b) => ({ ...b, label: format(new Date(`${b.month}-01T00:00:00`), "MMM yyyy") }));
    const clientRows = Array.from(byClient.entries())
      .map(([clientId, amounts]) => ({
        clientId,
        name: clients.find((c) => c.id === clientId)?.name ?? "Unknown client",
        amounts,
        total: modules.reduce((acc, m) => acc + amounts[m], 0),
      }))
      .sort((a, b) => b.total - a.total);
    return {
      byModule,
      total: modules.reduce((acc, m) => acc + byModule[m], 0),
      trend,
      clientRows,
    };
  }, [rows, modules, clients]);

  const basePath = portal?.base ?? "";
  const title = portal?.clientName ?? "Platform";

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Layers}
        title={`${title} Insights`}
        description={crossClient
          ? "Totals across every module and client. Open a module for its own dashboard and detailed insights."
          : "Totals across your modules. Open a module for its own dashboard and detailed insights."}
        onDownloadSection={() => downloadSectionAsPdf([
          { ref: trendRef, title: "Monthly Total by Module" },
          ...(crossClient ? [{ ref: clientsRef, title: "Totals by Client" }] : []),
        ], "overall-insights")}
      />

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>Period</Label>
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="ytd">This year</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {range === "custom" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="home-from">From</Label>
                <Input id="home-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="home-to">To</Label>
                <Input id="home-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
              </div>
            </>
          )}
          {crossClient && (
            <div className="space-y-1">
              <Label>Client</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CLIENTS}>All clients</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {rows === undefined ? (
        <InsightsLoadingSkeleton />
      ) : rows === null ? (
        <EmptyState message="Overall totals aren't available yet - the 0030/0031 database migrations need to be applied." />
      ) : (
        <>
          <StatCard icon={Sigma} label="Overall Total (all modules)" value={data.total} formatter={formatCurrency} />

          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            {modules.map((key, i) => {
              const m = MODULES[key];
              const Icon = m.icon;
              const share = data.total > 0 ? Math.round((data.byModule[key] / data.total) * 100) : 0;
              return (
                <Card key={key} className="flex flex-col animate-in fade-in-0 slide-in-from-bottom-4" style={{ animationDelay: `${50 * (i + 1)}ms` }}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{m.label}</CardTitle>
                      <CardDescription>{MODULE_AMOUNT_LABEL[key]}</CardDescription>
                    </div>
                    <Icon className="h-5 w-5 shrink-0" />
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2">
                    <p className="text-2xl md:text-3xl font-bold tabular-nums truncate" style={{ color: m.color }}>
                      {formatCurrency(data.byModule[key])}
                    </p>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${share}%`, background: m.color }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{share}% of the overall total</p>
                  </CardContent>
                  <div className="px-6 pb-6">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={modulePath(basePath, key)}>
                        Open {m.label}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <ChartCard title="Monthly Total by Module" chartRef={trendRef} filename="monthly-total-by-module">
            {data.trend.length === 0 ? <EmptyState message="No dated payments in this period." /> : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(v) => formatCurrency(v).replace(/\.00$/, "")} width={110} />
                  <Tooltip {...glassTooltipStyle} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                  <Legend />
                  {modules.map((key, i) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={MODULES[key].label}
                      stackId="total"
                      fill={MODULES[key].color}
                      radius={i === modules.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {crossClient && (
            <ChartCard title="Totals by Client" chartRef={clientsRef} filename="totals-by-client">
              {data.clientRows.length === 0 ? <EmptyState message="No payments in this period." /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      {modules.map((key) => <TableHead key={key} className="text-right">{MODULES[key].label}</TableHead>)}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.clientRows.map((c) => (
                      <TableRow key={c.clientId}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        {modules.map((key) => <TableCell key={key} className="text-right tabular-nums">{formatCurrency(c.amounts[key])}</TableCell>)}
                        <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(c.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>All clients</TableCell>
                      {modules.map((key) => <TableCell key={key} className="text-right tabular-nums">{formatCurrency(data.byModule[key])}</TableCell>)}
                      <TableCell className="text-right tabular-nums">{formatCurrency(data.total)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}
