"use client";

import { useMemo, useRef } from "react";
import { format, isValid } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { GraduationCap } from "lucide-react";
import type { PerdiemRequest, AppEvent, Venue } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { ChartCard, SectionHeader, EmptyState, paletteColor, glassTooltipStyle, downloadSectionAsPdf } from "./shared";

/** Prefers the dedicated training-days field from the newer historical
 * import format; falls back to the raw count of attended/paid dates for
 * older-format events that predate it - same fallback convention already
 * used in admin-dashboard.tsx's handleDownloadPerDiemReport CSV export. */
function trainingDaysFor(event: AppEvent): number {
  if (event.numberOfTrainingDays && event.numberOfTrainingDays > 0) return event.numberOfTrainingDays;
  return event.eventDates?.length ?? 0;
}

function eventTimestamp(event: AppEvent): Date | null {
  const raw = event.trainingStartDate || event.eventDates?.[0] || event.createdAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  return isValid(parsed) ? parsed : null;
}

export function TrainingSection({ requests, events, venues }: { requests: PerdiemRequest[]; events: AppEvent[]; venues: Venue[] }) {
  const durationRef = useRef<HTMLDivElement>(null);
  const venuesRef = useRef<HTMLDivElement>(null);
  const countiesRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const scatterRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const durationBuckets = new Map<string, number>([["1 day", 0], ["2 days", 0], ["3 days", 0], ["4+ days", 0]]);
    for (const e of events) {
      const days = trainingDaysFor(e);
      if (days <= 0) continue;
      const key = days === 1 ? "1 day" : days === 2 ? "2 days" : days === 3 ? "3 days" : "4+ days";
      durationBuckets.set(key, (durationBuckets.get(key) || 0) + 1);
    }
    const durationData = Array.from(durationBuckets.entries()).map(([range, count]) => ({ range, count }));

    const venueCounts = new Map<string, number>();
    for (const e of events) {
      if (!e.venueName) continue;
      venueCounts.set(e.venueName, (venueCounts.get(e.venueName) || 0) + 1);
    }
    const venueData = Array.from(venueCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const countyCounts = new Map<string, number>();
    for (const e of events) {
      const county = venues.find(v => v.id === e.venueId)?.county;
      if (!county) continue;
      countyCounts.set(county, (countyCounts.get(county) || 0) + 1);
    }
    const countyData = Array.from(countyCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const monthCounts = new Map<string, number>();
    for (const e of events) {
      const ts = eventTimestamp(e);
      if (!ts) continue;
      const key = format(ts, "yyyy-MM");
      monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
    }
    const timeData = Array.from(monthCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({ month: format(new Date(`${key}-01`), "MMM yyyy"), count }));

    const scatterData = requests
      .map(r => {
        const event = events.find(e => e.id === r.eventId);
        if (!event) return null;
        const days = trainingDaysFor(event);
        if (days <= 0) return null;
        return { days, amount: r.totalPerdiem };
      })
      .filter((d): d is { days: number; amount: number } => d !== null);

    return { durationData, venueData, countyData, timeData, scatterData };
  }, [requests, events, venues]);

  if (events.length === 0) {
    return <EmptyState message="No event/training data yet - once events exist, this section fills in automatically." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={GraduationCap}
        title="Training"
        description="Training duration, venues, and timing across every client."
        onDownloadSection={() => downloadSectionAsPdf([
          { ref: durationRef, title: "Training Duration Distribution" },
          { ref: venuesRef, title: "Top Venues" },
          { ref: countiesRef, title: "Top Counties" },
          { ref: timeRef, title: "Events Over Time" },
          { ref: scatterRef, title: "Training Days vs Amount Paid" },
        ], "training-insights")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Training Duration Distribution" chartRef={durationRef} filename="training-duration-distribution">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.durationData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="range" />
              <YAxis allowDecimals={false} />
              <Tooltip {...glassTooltipStyle} />
              <Bar dataKey="count" name="Events" fill={paletteColor(0)} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Venues" chartRef={venuesRef} filename="top-venues">
          {data.venueData.length === 0 ? <EmptyState message="No venue data yet." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.venueData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={130} />
                <Tooltip {...glassTooltipStyle} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {data.venueData.map((_, i) => <Cell key={i} fill={paletteColor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Top Counties" chartRef={countiesRef} filename="top-counties">
          {data.countyData.length === 0 ? <EmptyState message="No county data yet." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.countyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip {...glassTooltipStyle} />
                <Bar dataKey="value" name="Events" fill={paletteColor(2)} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Events Over Time" chartRef={timeRef} filename="events-over-time">
          {data.timeData.length === 0 ? <EmptyState message="No dated events yet." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.timeData}>
                <defs>
                  <linearGradient id="eventsTimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip {...glassTooltipStyle} />
                <Area type="monotone" dataKey="count" name="Events" stroke="hsl(var(--chart-2))" fill="url(#eventsTimeGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Training Days vs Amount Paid" chartRef={scatterRef} filename="training-days-vs-amount">
        {data.scatterData.length === 0 ? <EmptyState message="No matching request/event data yet." /> : (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" dataKey="days" name="Training Days" allowDecimals={false} />
              <YAxis type="number" dataKey="amount" name="Amount" tickFormatter={(v) => formatCurrency(v)} />
              <ZAxis range={[80, 80]} />
              <Tooltip {...glassTooltipStyle} formatter={(v: number, name: string) => name === "amount" ? formatCurrency(v) : v} />
              <Scatter data={data.scatterData} fill={paletteColor(3)} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
