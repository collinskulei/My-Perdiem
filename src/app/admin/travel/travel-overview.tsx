/**
 * @file Travel & Ground Transfers "Overview" tab: headline totals, spend
 * by month (split by type), by type and by supplier, and a per-event
 * table. Rolled up in the browser from the payments the dashboard loaded.
 */
"use client";

import { useMemo, useRef } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { Banknote, Bus, Plane, Receipt, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCurrencyWhole } from "@/lib/utils";
import type { TravelPayment } from "@/lib/supabase/travel";
import { formatDate } from "@/lib/hotels/parse";
import { StatCard, ChartCard, glassTooltipStyle, paletteColor } from "../insights/shared";
import { money, shortCurrency } from "../hotels/hotels-shared";
import { totalsBy, totalsByMonthAndType } from "./travel-shared";

const isFlight = (p: TravelPayment) => /flight/i.test(p.paymentType ?? "");

export function TravelOverview({ payments, onUpload }: { payments: TravelPayment[]; onUpload: () => void }) {
  const monthRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const supplierRef = useRef<HTMLDivElement>(null);

  const types = useMemo(() => totalsBy(payments, (p) => p.paymentType), [payments]);
  const months = useMemo(() => totalsByMonthAndType(payments, types.map((t) => t.name)), [payments, types]);
  const suppliers = useMemo(() => totalsBy(payments.filter((p) => p.supplier), (p) => p.supplier), [payments]);
  const events = useMemo(() => totalsBy(payments, (p) => p.eventName), [payments]);

  if (payments.length === 0) {
    return (
      <div className="text-center p-10 text-muted-foreground space-y-3">
        <p>No travel payments on file yet.</p>
        <Button variant="outline" size="sm" onClick={onUpload}>
          <Upload className="mr-2 h-4 w-4" />
          Upload a travel payments file
        </Button>
      </div>
    );
  }

  const total = payments.reduce((acc, p) => acc + p.amount, 0);
  const flights = payments.filter(isFlight).reduce((acc, p) => acc + p.amount, 0);
  const dates = payments.map((p) => p.paymentDate).sort();
  const chartHeight = (n: number) => Math.max(160, n * 34);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Payments made {formatDate(dates[0])} to {formatDate(dates[dates.length - 1])}
      </p>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Banknote} label="Total Paid" value={total} formatter={formatCurrencyWhole} />
        <StatCard icon={Plane} label="Flights (incl. rescheduling)" value={flights} formatter={formatCurrencyWhole} delay={50} />
        <StatCard icon={Bus} label="Ground Transfers & Other" value={total - flights} formatter={formatCurrencyWhole} delay={100} />
        <StatCard icon={Receipt} label="Payments" value={payments.length} delay={150} />
      </div>

      <ChartCard title="Paid by Month" chartRef={monthRef} filename="travel-payments-by-month">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={months}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={shortCurrency} width={90} />
            <Tooltip {...glassTooltipStyle} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
            <Legend />
            {types.map((t, i) => (
              <Bar key={t.name} dataKey={t.name} stackId="paid" fill={paletteColor(i)} radius={i === types.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Amount Paid by Type" chartRef={typeRef} filename="travel-payments-by-type">
          <ResponsiveContainer width="100%" height={chartHeight(types.length)}>
            <BarChart data={types} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" tickFormatter={shortCurrency} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
              <Tooltip {...glassTooltipStyle} formatter={(v: number) => [formatCurrency(v), "Paid"]} />
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {types.map((_, i) => <Cell key={i} fill={paletteColor(i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Amount Paid by Supplier" chartRef={supplierRef} filename="travel-payments-by-supplier">
          {suppliers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No suppliers recorded.</p>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight(suppliers.length)}>
              <BarChart data={suppliers} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tickFormatter={shortCurrency} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                <Tooltip {...glassTooltipStyle} formatter={(v: number) => [formatCurrency(v), "Paid"]} />
                <Bar dataKey="total" fill={paletteColor(2)} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold">By Event</h3>
        <ScrollableTable containerClassName="max-h-[28rem] border rounded-md" stickyHeader aria-label="Travel payments by event">
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead className="text-right">Payments</TableHead>
              <TableHead className="text-right">Amount (KES)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.name}>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell className="text-right tabular-nums">{e.payments}</TableCell>
                <TableCell className="text-right tabular-nums">{money(e.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">{payments.length}</TableCell>
              <TableCell className="text-right tabular-nums">{money(total)}</TableCell>
            </TableRow>
          </TableFooter>
        </ScrollableTable>
      </div>
    </div>
  );
}
