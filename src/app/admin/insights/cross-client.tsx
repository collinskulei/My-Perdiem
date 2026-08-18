"use client";

import { useMemo, useRef, useState } from "react";
import { format, isValid, startOfMonth, subMonths } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line,
} from "recharts";
import { ArrowUpDown, Building2 } from "lucide-react";
import type { PerdiemRequest, AppEvent, Participant, Client } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChartCard, SectionHeader, EmptyState, InsightCard, paletteColor, glassTooltipStyle, downloadSectionAsPdf } from "./shared";

type Rollup = { clientId: string; name: string; requestCount: number; totalPaid: number; participantCount: number; eventCount: number };
type SortKey = keyof Omit<Rollup, "clientId" | "name">;

export function CrossClientSection({ requests, events, participants, clients }: {
  requests: PerdiemRequest[]; events: AppEvent[]; participants: Participant[]; clients: Client[];
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>("totalPaid");

  const rollups = useMemo<Rollup[]>(() => {
    return clients.map(c => ({
      clientId: c.id,
      name: c.name,
      requestCount: requests.filter(r => r.clientId === c.id).length,
      totalPaid: requests.filter(r => r.clientId === c.id && r.status === "Paid").reduce((s, r) => s + r.totalPerdiem, 0),
      participantCount: participants.filter(p => p.clientId === c.id && p.accessTier === "client_user").length,
      eventCount: events.filter(e => e.clientId === c.id).length,
    }));
  }, [requests, events, participants, clients]);

  const sortedRollups = useMemo(
    () => [...rollups].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number)),
    [rollups, sortKey]
  );

  const topClients = sortedRollups.slice(0, 5);

  const radarData = useMemo(() => {
    const maxOf = (key: SortKey) => Math.max(1, ...rollups.map(r => r[key] as number));
    const maxRequests = maxOf("requestCount");
    const maxPaid = maxOf("totalPaid");
    const maxParticipants = maxOf("participantCount");
    const maxEvents = maxOf("eventCount");
    const metrics: { metric: string; get: (r: Rollup) => number }[] = [
      { metric: "Requests", get: r => (r.requestCount / maxRequests) * 100 },
      { metric: "Amount Paid", get: r => (r.totalPaid / maxPaid) * 100 },
      { metric: "Participants", get: r => (r.participantCount / maxParticipants) * 100 },
      { metric: "Events", get: r => (r.eventCount / maxEvents) * 100 },
    ];
    return metrics.map(({ metric, get }) => {
      const row: Record<string, string | number> = { metric };
      for (const client of topClients) row[client.name] = Math.round(get(client));
      return row;
    });
  }, [rollups, topClients]);

  const activityOverTime = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
    return months.map(monthStart => {
      const key = format(monthStart, "yyyy-MM");
      const row: Record<string, string | number> = { month: format(monthStart, "MMM yyyy") };
      for (const client of topClients) {
        row[client.name] = requests.filter(r => {
          if (r.clientId !== client.clientId) return false;
          const parsed = new Date(r.date);
          return isValid(parsed) && format(parsed, "yyyy-MM") === key;
        }).length;
      }
      return row;
    });
  }, [requests, topClients]);

  if (clients.length === 0) {
    return <EmptyState message="No clients yet - once more than one client has data, cross-client comparisons appear here." />;
  }

  const sortButton = (key: SortKey, label: string) => (
    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => setSortKey(key)}>
      {label} <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Building2}
        title="Cross-Client"
        description="Compare activity and spend across every client on the platform - unique to Super/Master Admin."
        onDownloadSection={() => downloadSectionAsPdf([
          { ref: tableRef, title: "Per-Client Rollup" },
          { ref: barRef, title: "Requests per Client" },
          { ref: radarRef, title: "Client Comparison" },
          { ref: lineRef, title: "Client Activity Over Time" },
        ], "cross-client-insights")}
      />

      {clients.length < 2 && (
        <p className="text-sm text-muted-foreground italic">
          Only one client currently has data - comparisons below will look flat until a second client does too.
        </p>
      )}

      <InsightCard>
        <div ref={tableRef} className="p-6 space-y-4">
          <h4 className="font-medium">Per-Client Rollup</h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">{sortButton("requestCount", "Requests")}</TableHead>
                  <TableHead className="text-right">{sortButton("totalPaid", "Total Paid")}</TableHead>
                  <TableHead className="text-right">{sortButton("participantCount", "Participants")}</TableHead>
                  <TableHead className="text-right">{sortButton("eventCount", "Events")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRollups.map(r => (
                  <TableRow key={r.clientId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.requestCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.totalPaid)}</TableCell>
                    <TableCell className="text-right">{r.participantCount}</TableCell>
                    <TableCell className="text-right">{r.eventCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </InsightCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Requests per Client" chartRef={barRef} filename="requests-per-client">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sortedRollups} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={120} />
              <Tooltip {...glassTooltipStyle} />
              <Bar dataKey="requestCount" name="Requests" radius={[0, 6, 6, 0]}>
                {sortedRollups.map((_, i) => <Cell key={i} fill={paletteColor(i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Client Comparison" chartRef={radarRef} filename="client-comparison-radar">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tickCount={5} />
              <Tooltip {...glassTooltipStyle} />
              <Legend />
              {topClients.map((client, i) => (
                <Radar key={client.clientId} name={client.name} dataKey={client.name} stroke={paletteColor(i)} fill={paletteColor(i)} fillOpacity={0.15} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Client Activity Over Time (Top 5)" chartRef={lineRef} filename="client-activity-over-time">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={activityOverTime}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="month" />
            <YAxis allowDecimals={false} />
            <Tooltip {...glassTooltipStyle} />
            <Legend />
            {topClients.map((client, i) => (
              <Line key={client.clientId} type="monotone" dataKey={client.name} stroke={paletteColor(i)} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
