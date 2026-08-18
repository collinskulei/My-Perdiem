"use client";

import { useMemo, useRef } from "react";
import { format, isValid, subDays, subMonths, startOfMonth } from "date-fns";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
  ComposedChart, Line,
  Treemap,
} from "recharts";
import { ClipboardList, Wallet, Users, CalendarDays, Building2 } from "lucide-react";
import type { PerdiemRequest, AppEvent, Participant, Client } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import {
  StatCard, ChartCard, SectionHeader, EmptyState,
  STATUS_COLORS, paletteColor, glassTooltipStyle, downloadSectionAsPdf,
} from "./shared";

export function OverviewSection({ requests, events, participants, clients }: {
  requests: PerdiemRequest[];
  events: AppEvent[];
  participants: Participant[];
  clients: Client[];
}) {
  const trendRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const topClientsRef = useRef<HTMLDivElement>(null);
  const composedRef = useRef<HTMLDivElement>(null);
  const treemapRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const totalPaidOut = requests.filter(r => r.status === "Paid").reduce((sum, r) => sum + r.totalPerdiem, 0);
    const nonAdminParticipants = participants.filter(p => p.accessTier === "client_user");

    const byStatus = requests.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));

    const byDate = requests.reduce((acc, r) => {
      const parsed = new Date(r.date);
      if (!isValid(parsed)) return acc;
      const key = format(parsed, "yyyy-MM-dd");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const trendData = Array.from({ length: 90 }, (_, i) => {
      const date = subDays(new Date(), 89 - i);
      const key = format(date, "yyyy-MM-dd");
      return { date: format(date, "MMM d"), count: byDate[key] || 0 };
    });

    const paidByClient = new Map<string, number>();
    for (const r of requests) {
      if (r.status !== "Paid") continue;
      paidByClient.set(r.clientId, (paidByClient.get(r.clientId) || 0) + r.totalPerdiem);
    }
    const topClients = Array.from(paidByClient.entries())
      .map(([clientId, amount]) => ({ name: clients.find(c => c.id === clientId)?.name ?? "Unknown", amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    const monthly = new Map<string, { count: number; amount: number }>();
    for (let i = 5; i >= 0; i--) {
      const key = format(startOfMonth(subMonths(new Date(), i)), "MMM yyyy");
      monthly.set(key, { count: 0, amount: 0 });
    }
    for (const r of requests) {
      const parsed = new Date(r.date);
      if (!isValid(parsed)) continue;
      const key = format(startOfMonth(parsed), "MMM yyyy");
      const bucket = monthly.get(key);
      if (!bucket) continue; // outside the 6-month window
      bucket.count += 1;
      bucket.amount += r.totalPerdiem;
    }
    const composedData = Array.from(monthly.entries()).map(([month, v]) => ({ month, ...v }));

    const treemapData = Array.from(paidByClient.entries())
      .map(([clientId, amount]) => ({ name: clients.find(c => c.id === clientId)?.name ?? "Unknown", size: amount }))
      .filter(d => d.size > 0);

    return {
      totalRequests: requests.length,
      totalPaidOut,
      totalParticipants: nonAdminParticipants.length,
      totalEvents: events.length,
      activeClients: clients.length,
      statusData,
      trendData,
      topClients,
      composedData,
      treemapData,
    };
  }, [requests, events, participants, clients]);

  if (requests.length === 0) {
    return <EmptyState message="No per diem data yet - once requests exist, this section fills in automatically." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={ClipboardList}
        title="Overview"
        description="Platform-wide activity at a glance, across every client."
        onDownloadSection={() => downloadSectionAsPdf([
          { ref: statusRef, title: "Requests by Status" },
          { ref: trendRef, title: "Requests Trend (90 Days)" },
          { ref: topClientsRef, title: "Top Clients by Amount Paid" },
          { ref: composedRef, title: "Requests Volume vs Amount Paid" },
          { ref: treemapRef, title: "Client Share of Total Spend" },
        ], "overview-insights")}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={ClipboardList} label="Total Requests" value={data.totalRequests} delay={0} />
        <StatCard icon={Wallet} label="Total Paid Out" value={data.totalPaidOut} formatter={formatCurrency} delay={50} />
        <StatCard icon={Users} label="Total Participants" value={data.totalParticipants} delay={100} />
        <StatCard icon={CalendarDays} label="Total Events" value={data.totalEvents} delay={150} />
        <StatCard icon={Building2} label="Active Clients" value={data.activeClients} delay={200} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Requests by Status" chartRef={statusRef} filename="requests-by-status">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={2} label>
                {data.statusData.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.name] ?? paletteColor(i)} />
                ))}
              </Pie>
              <Tooltip {...glassTooltipStyle} formatter={(value: number, name: string) => [`${value} requests`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Requests Trend (90 Days)" chartRef={trendRef} filename="requests-trend-90-days">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.trendData}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" interval={13} />
              <YAxis allowDecimals={false} />
              <Tooltip {...glassTooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#trendGradient)" name="Requests" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Top Clients by Amount Paid" chartRef={topClientsRef} filename="top-clients-by-amount-paid">
          {data.topClients.length === 0 ? <EmptyState message="No paid requests yet." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topClients} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip {...glassTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {data.topClients.map((_, i) => <Cell key={i} fill={paletteColor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Requests Volume vs Amount Paid" chartRef={composedRef} filename="requests-volume-vs-amount">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.composedData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip {...glassTooltipStyle} formatter={(v: number, name: string) => name === "amount" ? formatCurrency(v) : v} />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name="Requests" fill={paletteColor(0)} radius={[6, 6, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="amount" name="Amount" stroke="hsl(var(--primary))" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Client Share of Total Spend" chartRef={treemapRef} filename="client-share-of-spend">
        {data.treemapData.length === 0 ? <EmptyState message="No paid requests yet." /> : (
          <ResponsiveContainer width="100%" height={320}>
            <Treemap data={data.treemapData} dataKey="size" nameKey="name" stroke="hsl(var(--card))">
              {data.treemapData.map((_, i) => <Cell key={i} fill={paletteColor(i)} />)}
              <Tooltip {...glassTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
            </Treemap>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
