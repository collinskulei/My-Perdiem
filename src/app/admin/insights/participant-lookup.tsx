"use client";

import { useMemo, useState } from "react";
import { Search, UserSearch } from "lucide-react";
import type { PerdiemRequest, Client } from "@/lib/data";
import { formatCurrency, formatDateSafe } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InsightCard } from "./shared";

/**
 * Always-visible participant search across every client's payment history -
 * distinct from the sub-tab charts below it, this answers "how much has
 * this specific person been paid in total, and what are all their payment
 * records" directly, matching on the request's own name/phone snapshot so
 * it finds historical-import participants with no app account too (see
 * the equivalent fix on the Reports tab's Participant filter).
 */
// A broad query (a common name, or a short digit prefix) can match
// thousands of the 9,000+ requests - capping how many rows actually render
// keeps the table from blocking the main thread, without affecting the
// totals below, which are computed over every match, not just the shown rows.
const MAX_VISIBLE_MATCHES = 200;

export function ParticipantLookup({ requests, clients }: { requests: PerdiemRequest[]; clients: Client[] }) {
  const [query, setQuery] = useState("");

  const clientsById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return requests.filter(r =>
      r.participantName.toLowerCase().includes(q) ||
      (r.participantPhone ?? "").includes(q)
    );
  }, [requests, query]);

  const visibleMatches = matches.length > MAX_VISIBLE_MATCHES ? matches.slice(0, MAX_VISIBLE_MATCHES) : matches;
  const totalPaid = matches.filter(r => r.status === "Paid" || r.status === "Confirmed").reduce((s, r) => s + r.totalPerdiem, 0);
  const totalAll = matches.reduce((s, r) => s + r.totalPerdiem, 0);

  return (
    <InsightCard>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserSearch className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Participant Lookup</h3>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search any participant by name or phone, across every client..."
            className="pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {query.trim() === "" ? (
          <p className="text-sm text-muted-foreground">Search a participant to see their total paid and every payment record, across all clients.</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching participant found.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Matching Requests</p>
                <p className="text-2xl font-bold">{matches.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Across All Statuses</p>
                <p className="text-2xl font-bold">{formatCurrency(totalAll)}</p>
              </div>
            </div>
            <div className="overflow-x-auto max-h-80 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMatches.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium whitespace-nowrap">{r.participantName}</TableCell>
                      <TableCell>{r.participantPhone ?? "—"}</TableCell>
                      <TableCell>{clientsById.get(r.clientId)?.name ?? "—"}</TableCell>
                      <TableCell>{r.eventName}</TableCell>
                      <TableCell>{formatDateSafe(r.date)}</TableCell>
                      <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(r.totalPerdiem)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {matches.length > MAX_VISIBLE_MATCHES && (
              <p className="text-sm text-muted-foreground">
                Showing the first {MAX_VISIBLE_MATCHES} of {matches.length} matches - refine your search to narrow this down.
              </p>
            )}
          </>
        )}
      </div>
    </InsightCard>
  );
}
