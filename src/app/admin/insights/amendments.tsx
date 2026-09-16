"use client";

import { useMemo, useRef } from "react";
import { FileEdit, AlertCircle, CheckCircle2, Hourglass } from "lucide-react";
import type { PerdiemRequest, Client } from "@/lib/data";
import { formatCurrency, formatDateSafe } from "@/lib/utils";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatCard, SectionHeader, EmptyState, InsightCard, downloadSectionAsPdf } from "./shared";

/**
 * Read-only view of every 'Amended' request across all clients, with a
 * particular focus on the overpayment-and-recovery shape (see
 * supabase/migrations/0022's header comment): a request flagged as overpaid
 * (totalPerdiem > originalTotal) tracks how much of the difference has come
 * back via recoveredAmount. *Updating* a recovery only happens from the
 * Reports tab's Amended sub-tab (the only place in the app that mutates
 * data) - this section is purely for spotting and reviewing it at a glance
 * across every client, matching every other Insights section's read-only
 * pattern.
 */
export function AmendmentsSection({ requests, clients }: { requests: PerdiemRequest[]; clients: Client[] }) {
  const tableRef = useRef<HTMLDivElement>(null);
  const clientsById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  const data = useMemo(() => {
    const amended = requests.filter(r => r.status === "Amended");
    const rows = amended.map(r => {
      const overpaid = Math.max(0, r.totalPerdiem - (r.originalTotal ?? r.totalPerdiem));
      const recovered = r.recoveredAmount ?? 0;
      const pending = overpaid - recovered;
      return { request: r, overpaid, recovered, pending };
    });
    const totalOverpaid = rows.reduce((s, r) => s + r.overpaid, 0);
    const totalRecovered = rows.reduce((s, r) => s + r.recovered, 0);
    const totalPending = rows.reduce((s, r) => s + r.pending, 0);
    // Highest-pending first, so the recoveries most worth chasing surface
    // immediately instead of needing a manual sort - fully-recovered and
    // non-overpayment amendments (pending <= 0) sink to the bottom.
    const sorted = [...rows].sort((a, b) => b.pending - a.pending);
    return { rows: sorted, totalOverpaid, totalRecovered, totalPending, overpaymentCount: rows.filter(r => r.overpaid > 0).length };
  }, [requests]);

  if (requests.filter(r => r.status === "Amended").length === 0) {
    return <EmptyState message="No amended requests yet - once a request is corrected or flagged as overpaid, it'll show up here." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={FileEdit}
        title="Amendments"
        description="Every corrected or overpaid request across all clients, and how much of each overpayment is still outstanding."
        onDownloadSection={() => downloadSectionAsPdf([{ ref: tableRef, title: "Amendments" }], "amendments-insights")}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileEdit} label="Amended Records" value={data.rows.length} delay={0} />
        <StatCard icon={AlertCircle} label="Total Overpaid" value={data.totalOverpaid} formatter={formatCurrency} delay={50} />
        <StatCard icon={CheckCircle2} label="Total Recovered" value={data.totalRecovered} formatter={formatCurrency} delay={100} />
        <StatCard icon={Hourglass} label="Total Pending" value={data.totalPending} formatter={formatCurrency} delay={150} />
      </div>

      <InsightCard>
        <div ref={tableRef} className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">All Amended Records</h3>
          <div className="overflow-x-auto max-h-[32rem] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="max-w-xs">Reason</TableHead>
                  <TableHead className="text-right">Overpaid</TableHead>
                  <TableHead className="text-right">Recovered</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map(({ request, overpaid, recovered, pending }) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium whitespace-nowrap">{request.participantName}</TableCell>
                    <TableCell>{clientsById.get(request.clientId)?.name ?? "—"}</TableCell>
                    <TableCell>{request.eventName}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateSafe(request.date)}</TableCell>
                    <TableCell className="max-w-xs truncate" title={request.amendmentReason}>{request.amendmentReason}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{overpaid > 0 ? formatCurrency(overpaid) : "-"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{overpaid > 0 ? formatCurrency(recovered) : "-"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {overpaid > 0 ? (
                        <span className={pending > 0 ? "text-amber-600 dark:text-amber-500 font-medium" : "text-green-600 dark:text-green-500"}>
                          {formatCurrency(pending)}
                        </span>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data.overpaymentCount === 0 && (
            <p className="text-sm text-muted-foreground">None of the amendments above are overpayments needing recovery - just requests corrected before payment.</p>
          )}
        </div>
      </InsightCard>
    </div>
  );
}
