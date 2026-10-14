/**
 * @file Refunds "Overview" tab: headline totals and refunds paid by month,
 * rolled up in the browser from the payments the dashboard loaded. A
 * record of payments on its own - nothing here is compared with the
 * client's other modules.
 */
"use client";

import { useMemo, useRef } from "react";
import { format } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Banknote, CalendarDays, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatCurrencyWhole } from "@/lib/utils";
import { MODULES } from "@/lib/modules";
import type { FundingReceipt } from "@/lib/supabase/funding";
import { formatDate } from "@/lib/hotels/parse";
import { StatCard, ChartCard, glassTooltipStyle } from "../insights/shared";
import { shortCurrency } from "../hotels/hotels-shared";

/** Oldest month first, with empty months in between filled in. */
function totalsByMonth(payments: FundingReceipt[]): { month: string; label: string; total: number }[] {
  if (payments.length === 0) return [];
  const map = new Map<string, number>();
  for (const p of payments) {
    const m = p.receivedDate.slice(0, 7);
    map.set(m, (map.get(m) ?? 0) + p.amount);
  }
  const months = Array.from(map.keys()).sort();
  const out: { month: string; label: string; total: number }[] = [];
  let [y, mo] = months[0].split("-").map(Number);
  const [ly, lm] = months[months.length - 1].split("-").map(Number);
  while (y < ly || (y === ly && mo <= lm)) {
    const key = `${y}-${String(mo).padStart(2, "0")}`;
    out.push({ month: key, label: format(new Date(y, mo - 1, 1), "MMM yyyy"), total: map.get(key) ?? 0 });
    mo += 1;
    if (mo > 12) { mo = 1; y += 1; }
  }
  return out;
}

export function FundingOverview({ payments, onAdd }: { payments: FundingReceipt[]; onAdd: () => void }) {
  const monthRef = useRef<HTMLDivElement>(null);
  const months = useMemo(() => totalsByMonth(payments), [payments]);

  if (payments.length === 0) {
    return (
      <div className="text-center p-10 text-muted-foreground space-y-3">
        <p>No refund payments on file yet.</p>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add a payment
        </Button>
      </div>
    );
  }

  const total = payments.reduce((acc, p) => acc + p.amount, 0);
  const dates = payments.map((p) => p.receivedDate).sort();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Payments made {formatDate(dates[0])} to {formatDate(dates[dates.length - 1])}
      </p>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-3">
        <StatCard icon={Banknote} label="Total Refunds Paid" value={total} formatter={formatCurrencyWhole} />
        <StatCard icon={Receipt} label="Payments" value={payments.length} delay={50} />
        <StatCard icon={CalendarDays} label="Months with Payments" value={months.filter((m) => m.total > 0).length} delay={100} />
      </div>

      <ChartCard title="Refunds Paid by Month" chartRef={monthRef} filename="refunds-by-month">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={months}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={shortCurrency} width={90} />
            <Tooltip {...glassTooltipStyle} formatter={(v: number) => [formatCurrency(v), "Paid"]} />
            <Bar dataKey="total" name="Paid" fill={MODULES.funding.color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
