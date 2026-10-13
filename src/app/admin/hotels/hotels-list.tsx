/**
 * @file Hotel Bookings "Hotels" tab: one row per hotel (payments grouped
 * by name, ignoring case and spacing) with where it is, how often and how
 * much it was paid, and which events it hosted.
 */
"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { HotelPayment } from "@/lib/supabase/hotels";
import { formatDate } from "@/lib/hotels/parse";
import { EmptyState } from "../insights/shared";
import { exportTable } from "../salary/salary-shared";
import { money, rollupByHotel } from "./hotels-shared";

export function HotelsList({ payments, clientName }: { payments: HotelPayment[]; clientName: string }) {
  const [query, setQuery] = useState("");
  const hotels = useMemo(() => rollupByHotel(payments), [payments]);
  const shown = hotels.filter((h) => {
    const q = query.trim().toLowerCase();
    return !q || h.hotelName.toLowerCase().includes(q) || h.locations.some((l) => l.toLowerCase().includes(q));
  });

  if (hotels.length === 0) return <EmptyState message="No hotel payments on file yet." />;

  const handleExport = () =>
    exportTable(
      `${clientName} - Hotels`,
      ["Hotel", "Location", "Payments", "Amount Paid (KES)", "First Payment", "Last Payment", "Events"],
      shown.map((h) => [h.hotelName, h.locations.join(", "), h.payments, h.total, formatDate(h.firstPayment), formatDate(h.lastPayment), h.events.join("; ")]),
      `${clientName || "client"}_hotels`
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search hotel or location" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={handleExport} disabled={shown.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Excel
        </Button>
      </div>
      <ScrollableTable containerClassName="max-h-[65vh] border rounded-md" stickyHeader aria-label="Hotels">
        <TableHeader>
          <TableRow>
            <TableHead>Hotel</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Payments</TableHead>
            <TableHead className="text-right">Amount Paid (KES)</TableHead>
            <TableHead>First Payment</TableHead>
            <TableHead>Last Payment</TableHead>
            <TableHead>Events</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((h) => (
            <TableRow key={h.key}>
              <TableCell className="font-medium">{h.hotelName}</TableCell>
              <TableCell>{h.locations.join(", ") || "-"}</TableCell>
              <TableCell className="text-right tabular-nums">{h.payments}</TableCell>
              <TableCell className="text-right tabular-nums">{money(h.total)}</TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(h.firstPayment)}</TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(h.lastPayment)}</TableCell>
              <TableCell className="max-w-sm text-sm text-muted-foreground">{h.events.join("; ") || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>{shown.length} hotel{shown.length === 1 ? "" : "s"}</TableCell>
            <TableCell className="text-right tabular-nums">{shown.reduce((acc, h) => acc + h.payments, 0)}</TableCell>
            <TableCell className="text-right tabular-nums">{money(shown.reduce((acc, h) => acc + h.total, 0))}</TableCell>
            <TableCell colSpan={3} />
          </TableRow>
        </TableFooter>
      </ScrollableTable>
    </div>
  );
}
