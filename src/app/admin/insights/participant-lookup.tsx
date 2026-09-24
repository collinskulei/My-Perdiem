"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserSearch } from "lucide-react";
import type { Client } from "@/lib/data";
import { searchInsightsRequests, type InsightsFilters, type InsightsSearchResult } from "@/lib/supabase/database";
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
// thousands of the 29,000+ requests - only this many rows (newest first)
// come back for the table. The count and totals below are still computed
// over every match, server-side.
const MAX_VISIBLE_MATCHES = 500;
// Waits for a pause in typing before searching, instead of a round trip
// per keystroke.
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The search itself runs in Postgres (search_insights_requests in
 * 0026_insights_stats_rpc.sql) rather than over a full requests array in
 * the browser. `filters` narrows it the same way as the rest of the
 * Insights tab; omitted (e.g. the Analytics tab) means no filter beyond RLS.
 */
export function ParticipantLookup({ clients, filters = null }: { clients: Client[]; filters?: InsightsFilters | null }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<InsightsSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);

  const clientsById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResult(null);
      setSearching(false);
      return;
    }
    // `cancelled` drops a slower, older search that lands after a newer one.
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchInsightsRequests(q, filters, MAX_VISIBLE_MATCHES)
        .then((r) => { if (!cancelled) { setResult(r); setFailed(false); } })
        .catch(() => { if (!cancelled) setFailed(true); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, filters]);

  const matchCount = result?.matchCount ?? 0;
  const visibleMatches = result?.rows ?? [];
  const totalPaid = result?.totalPaid ?? 0;
  const totalAll = result?.totalAll ?? 0;

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
        ) : failed ? (
          <p className="text-sm text-destructive">Search failed - please try again.</p>
        ) : !result || (searching && matchCount === 0) ? (
          <p className="text-sm text-muted-foreground">Searching...</p>
        ) : matchCount === 0 ? (
          <p className="text-sm text-muted-foreground">No matching participant found.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Matching Requests</p>
                <p className="text-2xl font-bold">{matchCount}</p>
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
            {matchCount > visibleMatches.length && (
              <p className="text-sm text-muted-foreground">
                Showing the first {visibleMatches.length} of {matchCount} matches - refine your search to narrow this down.
              </p>
            )}
          </>
        )}
      </div>
    </InsightCard>
  );
}
