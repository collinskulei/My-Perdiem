/**
 * @file Salary Payments "Overview" tab: the latest month at a glance, totals
 * for everything on file, and monthly trends. All figures are rolled up
 * from get_salary_run_summaries (one row per employer-month).
 */
"use client";

import { useMemo, useRef } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart,
} from "recharts";
import { Banknote, CalendarRange, HandCoins, Landmark, Users, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { SalaryRunSummary } from "@/lib/supabase/salary";
import { StatCard, ChartCard, EmptyState, glassTooltipStyle, paletteColor } from "../insights/shared";
import { rollupByPeriod } from "./salary-shared";

const shortCurrency = (v: number) =>
  Math.abs(v) >= 1_000_000 ? `KES ${(v / 1_000_000).toFixed(1)}M` : Math.abs(v) >= 1_000 ? `KES ${(v / 1_000).toFixed(0)}K` : `KES ${v}`;

export function SalaryOverview({ summaries }: { summaries: SalaryRunSummary[] }) {
  const costRef = useRef<HTMLDivElement>(null);
  const dedRef = useRef<HTMLDivElement>(null);
  const months = useMemo(() => rollupByPeriod(summaries), [summaries]);

  if (months.length === 0) {
    return <EmptyState message="No salary months on file yet - upload muster rolls from the Upload tab." />;
  }

  const latest = months[months.length - 1];
  const all = months.reduce(
    (acc, m) => ({ cost: acc.cost + m.salaryCost, net: acc.net + m.netPay, paye: acc.paye + m.paye }),
    { cost: 0, net: 0, paye: 0 }
  );
  const trend = months.map((m) => ({
    label: m.label,
    gross: m.grossPay,
    employer: m.employerContributions,
    headcount: m.headcount,
    paye: m.paye,
    nssf: m.nssf + m.employerNssf,
    shif: m.shif,
    housing: m.housingLevy + m.employerHousingLevy,
    other: m.totalOtherDeductions,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Latest month - {latest.label}</h3>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Banknote} label="Salary Cost" value={latest.salaryCost} formatter={formatCurrency} />
          <StatCard icon={Wallet} label="Gross Pay" value={latest.grossPay} formatter={formatCurrency} delay={50} />
          <StatCard icon={HandCoins} label="Net Pay" value={latest.netPay} formatter={formatCurrency} delay={100} />
          <StatCard icon={Users} label="Employees Paid" value={latest.headcount} delay={150} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          All months on file - {months[0].label} to {latest.label}
        </h3>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={CalendarRange} label="Months on File" value={months.length} />
          <StatCard icon={Banknote} label="Total Salary Cost" value={all.cost} formatter={formatCurrency} delay={50} />
          <StatCard icon={HandCoins} label="Total Net Pay" value={all.net} formatter={formatCurrency} delay={100} />
          <StatCard icon={Landmark} label="Total PAYE" value={all.paye} formatter={formatCurrency} delay={150} />
        </div>
      </div>

      <ChartCard title="Monthly Salary Cost and Headcount" chartRef={costRef} filename="salary-cost-by-month">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" />
            <YAxis yAxisId="left" tickFormatter={shortCurrency} width={90} />
            <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
            <Tooltip {...glassTooltipStyle} formatter={(v: number, name: string) => [name === "Employees" ? v : formatCurrency(v), name]} />
            <Legend />
            <Bar yAxisId="left" dataKey="gross" name="Gross Pay" stackId="cost" fill={paletteColor(1)} />
            <Bar yAxisId="left" dataKey="employer" name="Employer Contributions" stackId="cost" fill={paletteColor(3)} radius={[6, 6, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="headcount" name="Employees" stroke="hsl(var(--primary))" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Deductions and Contributions by Month" chartRef={dedRef} filename="salary-deductions-by-month">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={shortCurrency} width={90} />
            <Tooltip {...glassTooltipStyle} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
            <Legend />
            <Bar dataKey="paye" name="PAYE" stackId="d" fill={paletteColor(0)} />
            <Bar dataKey="nssf" name="NSSF (employee + employer)" stackId="d" fill={paletteColor(1)} />
            <Bar dataKey="shif" name="SHIF" stackId="d" fill={paletteColor(2)} />
            <Bar dataKey="housing" name="Housing Levy (employee + employer)" stackId="d" fill={paletteColor(4)} />
            <Bar dataKey="other" name="Other deductions" stackId="d" fill={paletteColor(3)} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
