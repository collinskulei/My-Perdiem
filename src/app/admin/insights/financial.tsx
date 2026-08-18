"use client";

import { useMemo, useRef } from "react";
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { DollarSign, TrendingUp, ArrowRightLeft } from "lucide-react";
import type { PerdiemRequest } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { StatCard, ChartCard, SectionHeader, EmptyState, STATUS_COLORS, paletteColor, glassTooltipStyle, downloadSectionAsPdf } from "./shared";

const AMOUNT_BUCKETS: [number, number, string][] = [
  [0, 5000, "0 - 5K"],
  [5000, 10000, "5K - 10K"],
  [10000, 20000, "10K - 20K"],
  [20000, 30000, "20K - 30K"],
  [30000, 50000, "30K - 50K"],
  [50000, Infinity, "50K+"],
];

export function FinancialSection({ requests }: { requests: PerdiemRequest[] }) {
  const allowanceRef = useRef<HTMLDivElement>(null);
  const statusAmountRef = useRef<HTMLDivElement>(null);
  const scatterRef = useRef<HTMLDivElement>(null);
  const histogramRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const sum = (get: (r: PerdiemRequest) => number | undefined) => requests.reduce((s, r) => s + (get(r) ?? 0), 0);
    const allowanceBreakdown = [
      { name: "Mileage", value: sum(r => r.mileageTotal) },
      { name: "Accommodation", value: sum(r => r.accommodationTotal) },
      { name: "Out of Office", value: sum(r => r.outOfOfficeAllowance) },
      { name: "Air Ticket", value: sum(r => r.airTicketCost) },
      { name: "Ground Transfer", value: sum(r => r.groundTransferCost) },
      { name: "Transport Allowance", value: sum(r => r.transportAllowance) },
      { name: "DSA Allowance", value: sum(r => r.dsaAllowance) },
    ].filter(d => d.value > 0);

    const totalPerdiemSum = requests.reduce((s, r) => s + r.totalPerdiem, 0);
    const avgPerDiem = requests.length > 0 ? totalPerdiemSum / requests.length : 0;

    const amended = requests.filter(r => r.status === "Amended" && r.originalTotal !== undefined);
    const totalAmendmentDelta = amended.reduce((s, r) => s + (r.totalPerdiem - (r.originalTotal ?? 0)), 0);

    const byStatus = new Map<string, number>();
    for (const r of requests) byStatus.set(r.status, (byStatus.get(r.status) || 0) + r.totalPerdiem);
    const statusAmountData = Array.from(byStatus.entries()).map(([name, value]) => ({ name, value }));

    const scatterData = amended.map(r => ({ original: r.originalTotal ?? 0, amended: r.totalPerdiem, name: r.participantName }));

    const histogram = AMOUNT_BUCKETS.map(([min, max, label]) => ({
      range: label,
      count: requests.filter(r => r.totalPerdiem >= min && r.totalPerdiem < max).length,
    }));

    return { allowanceBreakdown, avgPerDiem, totalAmendmentDelta, statusAmountData, scatterData, histogram };
  }, [requests]);

  if (requests.length === 0) {
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
