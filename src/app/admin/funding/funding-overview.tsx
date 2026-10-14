/**
 * @file Funding & Refunds "Reconciliation" tab: money received against
 * money paid out across the client's spend modules (Per Diem, Hotels,
 * Salary - whichever are on), month by month with a running balance.
 * Spend figures are the same ones the Home page shows
 * (get_platform_totals); receipts count by received date.
 */
"use client";

import { useMemo, useRef } from "react";
import { format } from "date-fns";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ArrowDownLeft, ArrowUpRight, Plus, Receipt, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCurrencyWhole } from "@/lib/utils";
import { MODULES, MODULE_KEYS, isSpendModule, type ModuleKey } from "@/lib/modules";
import type { FundingReceipt } from "@/lib/supabase/funding";
import type { PlatformTotalRow } from "@/lib/supabase/modules";
import { StatCard, ChartCard, EmptyState, glassTooltipStyle } from "../insights/shared";
import { money, shortCurrency } from "../hotels/hotels-shared";

const UNDATED = "Undated";

type MonthRow = {
  month: string;
  label: string;
  received: number;
  spend: Partial<Record<ModuleKey, number>>;
  paidOut: number;
  net: number;
  balance: number;
};

export function FundingOverview({ receipts, spend, onAdd }: {
  receipts: FundingReceipt[];
  /** null when spend totals couldn't be loaded. */
  spend: PlatformTotalRow[] | null;
  onAdd: () => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  const { rows, spendKeys, totals } = useMemo(() => {
    const spendRows = (spend ?? []).filter((r) => isSpendModule(r.module));
    const spendKeys = MODULE_KEYS.filter((k) => isSpendModule(k) && spendRows.some((r) => r.module === k));
    const byMonth = new Map<string, { received: number; spend: Partial<Record<ModuleKey, number>> }>();
    const bucket = (m: string) => {
      const b = byMonth.get(m) ?? { received: 0, spend: {} };
      byMonth.set(m, b);
      return b;
    };
    for (const r of receipts) bucket(r.receivedDate.slice(0, 7)).received += r.amount;
    for (const r of spendRows) {
      const b = bucket(r.month ?? UNDATED);
      b.spend[r.module] = (b.spend[r.module] ?? 0) + r.amount;
    }

    // Oldest month first, empty months filled in; undated spend last.
    const dated = Array.from(byMonth.keys()).filter((m) => m !== UNDATED).sort();
    const months: string[] = [];
    if (dated.length > 0) {
      let [y, mo] = dated[0].split("-").map(Number);
      const [ly, lm] = dated[dated.length - 1].split("-").map(Number);
      while (y < ly || (y === ly && mo <= lm)) {
        months.push(`${y}-${String(mo).padStart(2, "0")}`);
        mo += 1;
        if (mo > 12) { mo = 1; y += 1; }
      }
    }
    if (byMonth.has(UNDATED)) months.push(UNDATED);

    let balance = 0;
    const rows: MonthRow[] = months.map((m) => {
      const b = byMonth.get(m) ?? { received: 0, spend: {} };
      const paidOut = spendKeys.reduce((acc, k) => acc + (b.spend[k] ?? 0), 0);
      const net = b.received - paidOut;
      balance += net;
      return {
        month: m,
        label: m === UNDATED ? UNDATED : format(new Date(`${m}-01T00:00:00`), "MMM yyyy"),
        received: b.received,
        spend: b.spend,
        paidOut,
        net,
        balance,
      };
    });

    const received = rows.reduce((acc, r) => acc + r.received, 0);
    const paidOut = rows.reduce((acc, r) => acc + r.paidOut, 0);
    const byModule = Object.fromEntries(spendKeys.map((k) => [k, rows.reduce((acc, r) => acc + (r.spend[k] ?? 0), 0)])) as Partial<Record<ModuleKey, number>>;
    return { rows, spendKeys, totals: { received, paidOut, balance: received - paidOut, byModule } };
  }, [receipts, spend]);

  if (receipts.length === 0) {
    return (
      <div className="text-center p-10 text-muted-foreground space-y-3">
        <p>No money received on file yet.</p>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add a receipt
        </Button>
      </div>
    );
  }

  const chartRows = rows.filter((r) => r.month !== UNDATED);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ArrowDownLeft} label="Total Received" value={totals.received} formatter={formatCurrencyWhole} />
        <StatCard icon={ArrowUpRight} label="Total Paid Out" value={totals.paidOut} formatter={formatCurrencyWhole} delay={50} />
        <StatCard icon={Scale} label={totals.balance >= 0 ? "Received Above Paid Out" : "Paid Out Not Yet Reimbursed"} value={Math.abs(totals.balance)} formatter={formatCurrencyWhole} delay={100} />
        <StatCard icon={Receipt} label="Receipts" value={receipts.length} delay={150} />
      </div>

      {spend === null ? (
        <EmptyState message="Paid-out totals couldn't be loaded, so only receipts are shown." />
      ) : (
        <p className="text-sm text-muted-foreground">
          Paid out = {spendKeys.length > 0
            ? spendKeys.map((k) => `${MODULES[k].label} (${formatCurrencyWhole(totals.byModule[k] ?? 0)})`).join(" + ")
            : "nothing recorded in the client's other modules yet"}
          . Balance runs from the first month with any money in or out.
        </p>
      )}

      <ChartCard title="Received vs Paid Out by Month" chartRef={chartRef} filename="funding-reconciliation-by-month">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartRows}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={shortCurrency} width={90} />
            <Tooltip {...glassTooltipStyle} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
            <Legend />
            <Bar dataKey="received" name="Received" fill={MODULES.funding.color} radius={[6, 6, 0, 0]} />
            <Bar dataKey="paidOut" name="Paid out" fill="#64748b" radius={[6, 6, 0, 0]} />
            <Line dataKey="balance" name="Running balance" stroke="#ef4444" strokeWidth={2} dot={false} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="space-y-2">
        <h3 className="text-base font-semibold">Month by Month</h3>
        <ScrollableTable containerClassName="max-h-[32rem] border rounded-md" stickyHeader aria-label="Received vs paid out by month">
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Received</TableHead>
              {spendKeys.map((k) => <TableHead key={k} className="text-right">{MODULES[k].label}</TableHead>)}
              <TableHead className="text-right">Paid Out</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-right">Running Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.month}>
                <TableCell className="font-medium whitespace-nowrap">{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{r.received ? money(r.received) : "-"}</TableCell>
                {spendKeys.map((k) => <TableCell key={k} className="text-right tabular-nums">{r.spend[k] ? money(r.spend[k]!) : "-"}</TableCell>)}
                <TableCell className="text-right tabular-nums">{r.paidOut ? money(r.paidOut) : "-"}</TableCell>
                <TableCell className={`text-right tabular-nums ${r.net < 0 ? "text-destructive" : ""}`}>{money(r.net)}</TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${r.balance < 0 ? "text-destructive" : ""}`}>{money(r.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">{money(totals.received)}</TableCell>
              {spendKeys.map((k) => <TableCell key={k} className="text-right tabular-nums">{money(totals.byModule[k] ?? 0)}</TableCell>)}
              <TableCell className="text-right tabular-nums">{money(totals.paidOut)}</TableCell>
              <TableCell className={`text-right tabular-nums ${totals.balance < 0 ? "text-destructive" : ""}`}>{money(totals.balance)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </ScrollableTable>
      </div>
    </div>
  );
}
