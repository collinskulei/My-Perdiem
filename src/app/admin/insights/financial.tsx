"use client";

import { useMemo, useRef } from "react";
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { DollarSign, TrendingUp, ArrowRightLeft } from "lucide-react";
import type { InsightsStats } from "@/lib/supabase/database";
import { formatCurrency } from "@/lib/utils";
import { StatCard, ChartCard, SectionHeader, EmptyState, STATUS_COLORS, paletteColor, glassTooltipStyle, downloadSectionAsPdf } from "./shared";

// Labels for the histogram counts get_insights_stats returns - the bucket
// bounds themselves (0-5K, 5K-10K, ... 50K+) live in that SQL, in this order.
const AMOUNT_BUCKET_LABELS = ["0 - 5K", "5K - 10K", "10K - 20K", "20K - 30K", "30K - 50K", "50K+"];

export function FinancialSection({ stats }: { stats: InsightsStats }) {
  const allowanceRef = useRef<HTMLDivElement>(null);
  const statusAmountRef = useRef<HTMLDivElement>(null);
  const scatterRef = useRef<HTMLDivElement>(null);
  const histogramRef = useRef<HTMLDivElement>(null);

  // Sums/buckets arrive pre-aggregated from get_insights_stats
  // (0026_insights_stats_rpc.sql) - this only reshapes them for the charts.
  const data = useMemo(() => {
    const a = stats.allowances;
    const allowanceBreakdown = [
      { name: "Mileage", value: a.mileage },
      { name: "Accommodation", value: a.accommodation },
      { name: "Out of Office", value: a.outOfOffice },
      { name: "Air Ticket", value: a.airTicket },
      { name: "Ground Transfer", value: a.groundTransfer },
      { name: "Transport Allowance", value: a.transport },
      { name: "DSA Allowance", value: a.dsa },
    ].filter(d => d.value > 0);

    const { requestCount, totalPerdiem } = stats.totals;
    const avgPerDiem = requestCount > 0 ? totalPerdiem / requestCount : 0;

    const statusAmountData = stats.byStatus.map(s => ({ name: s.status, value: s.amount }));

    const scatterData = stats.amendedRows
      .filter(r => r.originalTotal !== undefined)
      .map(r => ({ original: r.originalTotal ?? 0, amended: r.totalPerdiem, name: r.participantName }));

    const histogram = AMOUNT_BUCKET_LABELS.map((range, i) => ({ range, count: stats.histogram[i] ?? 0 }));

    return { allowanceBreakdown, avgPerDiem, totalAmendmentDelta: stats.totals.amendmentDelta, statusAmountData, scatterData, histogram };
  }, [stats]);

  if (stats.totals.requestCount === 0) {
    return <EmptyState message="No per diem data yet - once requests exist, this section fills in automatically." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={DollarSign}
        title="Financial"
        description="Where the money goes, broken down by allowance type, status, and amendments."
        onDownloadSection={() => downloadSectionAsPdf([
          { ref: allowanceRef, title: "Allowance-Type Breakdown" },
          { ref: statusAmountRef, title: "Amount by Status" },
          { ref: scatterRef, title: "Amendment: Original vs Amended" },
          { ref: histogramRef, title: "Spend Distribution" },
        ], "financial-insights")}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <StatCard icon={TrendingUp} label="Average Per Diem per Request" value={data.avgPerDiem} formatter={formatCurrency} delay={0} />
        <StatCard icon={ArrowRightLeft} label="Total Amendment Delta" value={data.totalAmendmentDelta} formatter={formatCurrency} delay={50} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Allowance-Type Breakdown" chartRef={allowanceRef} filename="allowance-type-breakdown">
          {data.allowanceBreakdown.length === 0 ? <EmptyState message="No allowance breakdown data yet." /> : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.allowanceBreakdown} layout="vertical" margin={{ left: 32 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="name" width={130} />
                <Tooltip {...glassTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {data.allowanceBreakdown.map((_, i) => <Cell key={i} fill={paletteColor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Amount by Status" chartRef={statusAmountRef} filename="amount-by-status">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.statusAmountData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip {...glassTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.statusAmountData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name] ?? paletteColor(i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Amendment: Original vs Amended Amount" chartRef={scatterRef} filename="amendment-original-vs-amended">
          {data.scatterData.length === 0 ? <EmptyState message="No amended requests yet." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" dataKey="original" name="Original" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="number" dataKey="amended" name="Amended" tickFormatter={(v) => formatCurrency(v)} />
                <ZAxis range={[80, 80]} />
                <Tooltip {...glassTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                <Scatter data={data.scatterData} fill={paletteColor(3)} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Spend Distribution" chartRef={histogramRef} filename="spend-distribution">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.histogram}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="range" />
              <YAxis allowDecimals={false} />
              <Tooltip {...glassTooltipStyle} />
              <Bar dataKey="count" name="Requests" fill={paletteColor(2)} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
