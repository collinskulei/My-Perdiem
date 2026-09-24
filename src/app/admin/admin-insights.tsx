/**
 * @file Super/Master Admin "Insights" tab (see docs/MILESTONE_HANDOFF.md) -
 * a comprehensive analytics view across every client, distinct from the
 * simpler per-client "Analytics" tab every admin tier already sees. Gated
 * to isMultiClientAdmin by the caller (admin-dashboard.tsx), same as the
 * "Clients"/"Submissions" tabs.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { ListFilter, Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format, subDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AppEvent, Participant, Venue, Client } from "@/lib/data";
import { EVENT_TYPE_CATEGORIES } from "@/lib/data";
import { getInsightsStats, type InsightsFilters, type InsightsStats } from "@/lib/supabase/database";
import { useToast } from "@/hooks/use-toast";
import { InsightsLoadingSkeleton, InsightCard } from "./insights/shared";
import { ParticipantLookup } from "./insights/participant-lookup";
import { OverviewSection } from "./insights/overview";
import { FinancialSection } from "./insights/financial";
import { StaffEmployerSection } from "./insights/staff-employer";
import { TrainingSection } from "./insights/training";
import { CrossClientSection } from "./insights/cross-client";
import { AmendmentsSection } from "./insights/amendments";

const MONTH_OPTIONS = [
  { value: "01", label: "January" }, { value: "02", label: "February" }, { value: "03", label: "March" },
  { value: "04", label: "April" }, { value: "05", label: "May" }, { value: "06", label: "June" },
  { value: "07", label: "July" }, { value: "08", label: "August" }, { value: "09", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
];

export function AdminInsightsTab({ events, participants, venues, clients, loading }: {
  events: AppEvent[];
  participants: Participant[];
  venues: Venue[];
  clients: Client[];
  loading: boolean;
}) {
  // Event Type is the controlled category set on the event itself (see
  // EVENT_TYPE_CATEGORIES in lib/data.ts), not the raw eventName - applied
  // once here and cascaded to every sub-section + the participant lookup
  // below, rather than each section needing its own copy of this filter.
  const [eventType, setEventType] = useState("all");
  // County isn't a field on events/requests directly - it lives on the
  // venue (see Venue.county), so this resolves county -> matching venues ->
  // events held at those venues -> requests for those events, same
  // indirection the Reports tab's County filter already uses.
  const [county, setCounty] = useState("all");
  // Payment Date range - same field (PerdiemRequest.date) and widget as the
  // Reports tab's Date Range filter. Year/Month below are just a friendlier
  // way to set this same dateRange (see setYearMonthRange) for the common
  // case of "this whole year" or "this one month" - the calendar picker
  // stays for anything more specific (an arbitrary custom range).
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  // The specific event, by name - matched on PerdiemRequest.eventName/
  // AppEvent.name directly rather than eventId, since a name is what an
  // admin actually recognizes an event by, and (as seen in real data) two
  // separate event rows can legitimately share one name - filtering by name
  // catches both rather than picking one arbitrarily.
  const [eventName, setEventName] = useState("all");

  const countyOptions = useMemo(
    () => Array.from(new Set(venues.map(v => v.county).filter((c): c is string => !!c))).sort(),
    [venues]
  );

  const eventNameOptions = useMemo(
    () => Array.from(new Set(events.map(e => e.name).filter((n): n is string => !!n))).sort(),
    [events]
  );

  // Applies a Year (and optional Month) selection as a concrete dateRange -
  // month end uses day 0 of the following month (= last day of this one).
  // Only the calendar day matters (it's sent to the server as a plain
  // YYYY-MM-DD string, see dateFrom/dateTo below), not the time of day.
  const applyYearMonth = (year: string, month: string) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    if (year === "all") {
      setSelectedMonth("all");
      setDateRange(undefined);
      return;
    }
    const y = Number(year);
    if (month === "all") {
      setDateRange({ from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59, 999) });
    } else {
      const m = Number(month) - 1;
      setDateRange({ from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59, 999) });
    }
  };

  // The calendar picker sets an arbitrary range directly - Year/Month no
  // longer describes it accurately once that happens, so both reset to
  // "all" rather than keep showing a year/month that isn't what's applied.
  const handleCalendarSelect = (range: DateRange | undefined) => {
    setSelectedYear("all");
    setSelectedMonth("all");
    setDateRange(range);
  };

  // null (not just "all") when unfiltered, same reasoning as
  // eventIdsInCounty below.
  const eventIdsOfType = useMemo(() => {
    if (eventType === "all") return null;
    return new Set(events.filter(e => e.eventType === eventType).map(e => e.id));
  }, [eventType, events]);

  // null (not just "all") when unfiltered, same reasoning as
  // eventIdsInCounty below.
  const eventIdsOfName = useMemo(() => {
    if (eventName === "all") return null;
    return new Set(events.filter(e => e.name === eventName).map(e => e.id));
  }, [eventName, events]);

  // null (not just "all") when unfiltered, so eventIdsFilter/filteredEvents
  // below can tell "no county filter applied" apart from "this county has
  // zero matching events" without an extra branch at each call site.
  const eventIdsInCounty = useMemo(() => {
    if (county === "all") return null;
    const venueIds = new Set(venues.filter(v => v.county === county).map(v => v.id));
    return new Set(events.filter(e => venueIds.has(e.venueId)).map(e => e.id));
  }, [county, venues, events]);

  // Event Type / Event Name / County all narrow by event, so they collapse
  // into one event-ID list for the server (see get_insights_stats in
  // 0026_insights_stats_rpc.sql) - null when none of them is applied, an
  // empty list when they're applied but match no events.
  const eventIdsFilter = useMemo(() => {
    const sets = [eventIdsOfType, eventIdsOfName, eventIdsInCounty].filter((x): x is Set<string> => x !== null);
    if (sets.length === 0) return null;
    const [first, ...rest] = sets;
    return Array.from(first).filter(id => rest.every(set => set.has(id))).sort();
  }, [eventIdsOfType, eventIdsOfName, eventIdsInCounty]);

  // Payment Date range as inclusive 'YYYY-MM-DD' strings, compared directly
  // against the text `date` column server-side - which also means a record
  // dated on the range's last day is always included, regardless of the
  // browser's timezone. Both ends required, same as before.
  const dateFrom = dateRange?.from && dateRange.to ? format(dateRange.from, "yyyy-MM-dd") : null;
  const dateTo = dateRange?.from && dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : null;

  const filters = useMemo<InsightsFilters>(
    () => ({ eventIds: eventIdsFilter, dateFrom, dateTo }),
    [eventIdsFilter, dateFrom, dateTo]
  );

  // Every requests-derived number comes from Postgres rather than summing
  // the full perdiem_requests array here, so this tab no longer waits on
  // that (29,000+ row) download at all. Refetched whenever a filter
  // changes; `cancelled` drops an older response that lands after a newer one.
  const { toast } = useToast();
  const [stats, setStats] = useState<InsightsStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    const trendFrom = format(subDays(new Date(), 89), "yyyy-MM-dd");
    getInsightsStats(filters, trendFrom)
      .then((result) => { if (!cancelled) setStats(result); })
      .catch(() => {
        if (!cancelled) toast({ title: "Error", description: "Failed to load insights from the database.", variant: "destructive" });
      })
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, [filters, toast]);

  // Years actually present in the data, newest first (unfiltered, from the
  // server) - avoids offering a 2027 or 2023 option when nothing's recorded.
  const yearOptions = stats?.years ?? [];

  const filteredEvents = useMemo(() => {
    let data = events;
    if (eventIdsOfType) data = data.filter(e => eventIdsOfType.has(e.id));
    if (eventIdsOfName) data = data.filter(e => eventIdsOfName.has(e.id));
    if (eventIdsInCounty) data = data.filter(e => eventIdsInCounty.has(e.id));
    // Only events that had a request in the chosen date range - null when
    // no date filter is applied. Derived from requests, so it comes back
    // with the stats.
    const inRange = stats?.eventIdsInRange;
    if (inRange) {
      const ids = new Set(inRange);
      data = data.filter(e => ids.has(e.id));
    }
    return data;
  }, [events, eventIdsOfType, eventIdsOfName, eventIdsInCounty, stats]);

  // Skeleton only until the first stats arrive - later filter changes keep
  // the previous numbers on screen (dimmed below) until the new ones land.
  if (loading || !stats) {
    return <InsightsLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-[#3b82f6] bg-clip-text text-transparent">
          Insights
        </h2>
        <p className="text-muted-foreground">
          A full analytics view across every client - financials, staff/employer breakdowns, training trends, and cross-client comparisons.
        </p>
      </div>

      <InsightCard>
        <div className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ListFilter className="h-4 w-4 text-primary" />
            Filter everything below by:
          </div>
          <div className="w-full max-w-xs space-y-1.5">
            <Label htmlFor="insights-event-type">Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger id="insights-event-type"><SelectValue placeholder="All Event Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Event Types</SelectItem>
                {EVENT_TYPE_CATEGORIES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full max-w-xs space-y-1.5">
            <Label htmlFor="insights-event-name">Event Name</Label>
            <Select value={eventName} onValueChange={setEventName}>
              <SelectTrigger id="insights-event-name"><SelectValue placeholder="All Events" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {eventNameOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full max-w-xs space-y-1.5">
            <Label htmlFor="insights-county">County</Label>
            <Select value={county} onValueChange={setCounty}>
              <SelectTrigger id="insights-county"><SelectValue placeholder="All Counties" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Counties</SelectItem>
                {countyOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full max-w-[10rem] space-y-1.5">
            <Label htmlFor="insights-year">Year</Label>
            <Select value={selectedYear} onValueChange={(v) => applyYearMonth(v, selectedMonth)}>
              <SelectTrigger id="insights-year"><SelectValue placeholder="All Years" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full max-w-[11rem] space-y-1.5">
            <Label htmlFor="insights-month">Month</Label>
            <Select value={selectedMonth} onValueChange={(v) => applyYearMonth(selectedYear, v)} disabled={selectedYear === "all"}>
              <SelectTrigger id="insights-month"><SelectValue placeholder="All Months" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full max-w-xs space-y-1.5">
            <Label htmlFor="insights-date-range">Payment Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="insights-date-range"
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {dateRange?.from
                      ? (dateRange.to
                          ? <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                          : format(dateRange.from, "LLL dd, y"))
                      : "All dates"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" selected={dateRange} onSelect={handleCalendarSelect} numberOfMonths={2} />
                {dateRange && (
                  <div className="border-t p-2">
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => applyYearMonth("all", "all")}>
                      Clear dates
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </InsightCard>

      <ParticipantLookup clients={clients} filters={filters} />

      <Tabs defaultValue="overview" className={cn("transition-opacity", statsLoading && "opacity-60")}>
        <div className="overflow-x-auto pb-2">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="staff-employer">Staff & Employer</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
            <TabsTrigger value="cross-client">Cross-Client</TabsTrigger>
            <TabsTrigger value="amendments">Amendments</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <OverviewSection stats={stats} events={filteredEvents} participants={participants} clients={clients} />
        </TabsContent>
        <TabsContent value="financial">
          <FinancialSection stats={stats} />
        </TabsContent>
        <TabsContent value="staff-employer">
          <StaffEmployerSection stats={stats} participants={participants} />
        </TabsContent>
        <TabsContent value="training">
          <TrainingSection stats={stats} events={filteredEvents} venues={venues} />
        </TabsContent>
        <TabsContent value="cross-client">
          <CrossClientSection stats={stats} events={filteredEvents} participants={participants} clients={clients} />
        </TabsContent>
        <TabsContent value="amendments">
          <AmendmentsSection stats={stats} clients={clients} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
