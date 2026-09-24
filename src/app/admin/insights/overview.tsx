"use client";

import { useMemo, useRef } from "react";
import { format, subDays, subMonths, startOfMonth } from "date-fns";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
  ComposedChart, Line,
  Treemap,
} from "recharts";
import { ClipboardList, Wallet, Users, CalendarDays, Building2 } from "lucide-react";
import type { AppEvent, Participant, Client } from "@/lib/data";
import type { InsightsStats } from "@/lib/supabase/database";
import { formatCurrency } from "@/lib/utils";
import {
  StatCard, ChartCard, SectionHeader, EmptyState,
  STATUS_COLORS, paletteColor, glassTooltipStyle, downloadSectionAsPdf,
} from "./shared";

export function OverviewSection({ stats, events, participants, clients }: {
  stats: InsightsStats;
  events: AppEvent[];
  participants: Participant[];
  clients: Client[];
}) {
  const trendRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const topClientsRef = useRef<HTMLDivElement>(null);
  const composedRef = useRef<HTMLDivElement>(null);
  const treemapRef = useRef<HTMLDivElement>(null);

  // Request-derived numbers arrive pre-aggregated from get_insights_stats
  // (0026_insights_stats_rpc.sql) - this only reshapes them for the charts.
  const data = useMemo(() => {
    const nonAdminParticipants = participants.filter(p => p.accessTier === "client_user");
    const clientName = (clientId: string | null) => clients.find(c => c.id === clientId)?.name ?? "Unknown";

    const statusData = stats.byStatus.map(s => ({ name: s.status, value: s.count }));

    const byDate = new Map(stats.daily.map(d => [d.day, d.count]));
    const trendData = Array.from({ length: 90 }, (_, i) => {
      const date = subDays(new Date(), 89 - i);
      const key = format(date, "yyyy-MM-dd");
      return { date: format(date, "MMM d"), count: byDate.get(key) || 0 };
    });

    // total_paid includes overpayment-flagged Amended rows - see
    // isTransacted's comment. Overpayment/recovery amounts get their own
    // breakdown in the Amendments section, not a silent subtraction here.
    const paidClients = stats.byClient.filter(c => c.totalPaid > 0);
    const topClients = paidClients
      .map(c => ({ name: clientName(c.clientId), amount: c.totalPaid }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    const monthly = new Map<string, { month: string; count: number; amount: number }>();
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      monthly.set(format(monthStart, "yyyy-MM"), { month: format(monthStart, "MMM yyyy"), count: 0, amount: 0 });
    }
    for (const m of stats.monthlyByClient) {
      const bucket = monthly.get(m.month);
      if (!bucket) continue; // outside the 6-month window
      bucket.count += m.count;
      bucket.amount += m.amount;
    }
    const composedData = Array.from(monthly.values());

    const treemapData = paidClients.map(c => ({ name: clientName(c.clientId), size: c.totalPaid }));

    return {
      totalRequests: stats.totals.requestCount,
      totalPaidOut: stats.totals.totalPaidOut,
      totalParticipants: nonAdminParticipants.length,
      totalEvents: events.length,
      activeClients: clients.length,
      statusData,
      trendData,
      topClients,
      composedData,
      treemapData,
    };
  }, [stats, events, participants, clients]);

  if (stats.totals.requestCount === 0) {
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

      {/* Requests/Paid Out get their own row - those two values can grow
      long (request counts and KES amounts in the millions), so they're
      given half a row each instead of competing for space with the three
      short-integer cards below. */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
        <StatCard icon={ClipboardList} label="Total Requests" value={data.totalRequests} delay={0} />
        <StatCard icon={Wallet} label="Total Paid Out" value={data.totalPaidOut} formatter={formatCurrency} delay={50} />
      </div>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-3">
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
