/**
 * @file Hotel Bookings "Overview" tab: headline totals, spend by month,
 * by hotel, by event type and by location, and a per-event table. Rolled
 * up in the browser from the payments the dashboard loaded.
 */
"use client";

import { useMemo, useRef } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { Banknote, CalendarDays, Hotel, Receipt, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCurrencyWhole } from "@/lib/utils";
import type { HotelPayment } from "@/lib/supabase/hotels";
import { formatDate } from "@/lib/hotels/parse";
import { StatCard, ChartCard, glassTooltipStyle, paletteColor } from "../insights/shared";
import { money, rollupByEvent, rollupByHotel, shortCurrency, totalsBy, totalsByMonth } from "./hotels-shared";

const TOP_HOTELS = 10;

export function HotelsOverview({ payments, onUpload }: { payments: HotelPayment[]; onUpload?: () => void }) {
  const monthRef = useRef<HTMLDivElement>(null);
  const hotelRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => totalsByMonth(payments), [payments]);
  const hotels = useMemo(() => rollupByHotel(payments), [payments]);
  const events = useMemo(() => rollupByEvent(payments), [payments]);
  const types = useMemo(() => totalsBy(payments, (p) => p.eventType), [payments]);
  const locations = useMemo(() => totalsBy(payments, (p) => p.location), [payments]);

  if (payments.length === 0) {
    return (
      <div className="text-center p-10 text-muted-foreground space-y-3">
        <p>No hotel payments on file yet.</p>
        {onUpload && (
        <Button variant="outline" size="sm" onClick={onUpload}>
          <Upload className="mr-2 h-4 w-4" />
          Upload a hotel payments file
        </Button>
        )}
      </div>
    );
  }

  const total = payments.reduce((acc, p) => acc + p.amount, 0);
  const dates = payments.map((p) => p.paymentDate).sort();
  const topHotels = hotels.slice(0, TOP_HOTELS).map((h) => ({ name: h.hotelName, total: h.total }));
  const chartHeight = (n: number) => Math.max(160, n * 34);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Payments made {formatDate(dates[0])} to {formatDate(dates[dates.length - 1])}
      </p>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Banknote} label="Total Paid to Hotels" value={total} formatter={formatCurrencyWhole} />
        <StatCard icon={Receipt} label="Payments" value={payments.length} delay={50} />
        <StatCard icon={Hotel} label="Hotels Used" value={hotels.length} delay={100} />
        <StatCard icon={CalendarDays} label="Events" value={events.length} delay={150} />
      </div>

      <ChartCard title="Paid to Hotels by Month" chartRef={monthRef} filename="hotel-payments-by-month">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={months}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={shortCurrency} width={90} />
            <Tooltip {...glassTooltipStyle} formatter={(v: number) => [formatCurrency(v), "Paid"]} />
            <Bar dataKey="total" name="Paid" fill={paletteColor(0)} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title={hotels.length > TOP_HOTELS ? `Top ${TOP_HOTELS} Hotels by Amount Paid` : "Amount Paid by Hotel"} chartRef={hotelRef} filename="hotel-payments-by-hotel">
          <ResponsiveContainer width="100%" height={chartHeight(topHotels.length)}>
            <BarChart data={topHotels} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" tickFormatter={shortCurrency} />
              <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
              <Tooltip {...glassTooltipStyle} formatter={(v: number) => [formatCurrency(v), "Paid"]} />
              <Bar dataKey="total" fill={paletteColor(1)} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Amount Paid by Event Type" chartRef={typeRef} filename="hotel-payments-by-event-type">
          <ResponsiveContainer width="100%" height={chartHeight(types.length)}>
            <BarChart data={types} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" tickFormatter={shortCurrency} />
              <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
              <Tooltip {...glassTooltipStyle} formatter={(v: number) => [formatCurrency(v), "Paid"]} />
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {types.map((_, i) => <Cell key={i} fill={paletteColor(i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Amount Paid by Location" chartRef={locationRef} filename="hotel-payments-by-location">
        <ResponsiveContainer width="100%" height={chartHeight(locations.length)}>
          <BarChart data={locations} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis type="number" tickFormatter={shortCurrency} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
            <Tooltip {...glassTooltipStyle} formatter={(v: number) => [formatCurrency(v), "Paid"]} />
            <Bar dataKey="total" fill={paletteColor(2)} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="space-y-2">
        <h3 className="text-base font-semibold">By Event</h3>
        <ScrollableTable containerClassName="max-h-[28rem] border rounded-md" stickyHeader aria-label="Hotel payments by event">
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead className="text-right">Hotels</TableHead>
              <TableHead className="text-right">Payments</TableHead>
              <TableHead className="text-right">Amount (KES)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.key}>
                <TableCell className="font-medium">{e.eventName}</TableCell>
                <TableCell>{e.eventType}</TableCell>
                <TableCell className="text-right tabular-nums">{e.hotels}</TableCell>
                <TableCell className="text-right tabular-nums">{e.payments}</TableCell>
                <TableCell className="text-right tabular-nums">{money(e.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right tabular-nums">{payments.length}</TableCell>
              <TableCell className="text-right tabular-nums">{money(total)}</TableCell>
            </TableRow>
          </TableFooter>
        </ScrollableTable>
      </div>
    </div>
  );
}
