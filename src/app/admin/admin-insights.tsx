/**
 * @file Super/Master Admin "Insights" tab (see docs/MILESTONE_HANDOFF.md) -
 * a comprehensive analytics view across every client, distinct from the
 * simpler per-client "Analytics" tab every admin tier already sees. Gated
 * to isMultiClientAdmin by the caller (admin-dashboard.tsx), same as the
 * "Clients"/"Submissions" tabs.
 */
"use client";

import { useMemo, useState } from "react";
import { ListFilter, Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PerdiemRequest, AppEvent, Participant, Venue, Client } from "@/lib/data";
import { EVENT_TYPE_CATEGORIES } from "@/lib/data";
import { InsightsLoadingSkeleton, InsightCard } from "./insights/shared";
import { ParticipantLookup } from "./insights/participant-lookup";
import { OverviewSection } from "./insights/overview";
import { FinancialSection } from "./insights/financial";
import { StaffEmployerSection } from "./insights/staff-employer";
import { TrainingSection } from "./insights/training";
import { CrossClientSection } from "./insights/cross-client";

export function AdminInsightsTab({ requests, events, participants, venues, clients, loading }: {
  requests: PerdiemRequest[];
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
  // Reports tab's Date Range filter.
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const countyOptions = useMemo(
    () => Array.from(new Set(venues.map(v => v.county).filter((c): c is string => !!c))).sort(),
    [venues]
  );

  // null (not just "all") when unfiltered, same reasoning as
  // eventIdsInCounty below.
  const eventIdsOfType = useMemo(() => {
    if (eventType === "all") return null;
    return new Set(events.filter(e => e.eventType === eventType).map(e => e.id));
  }, [eventType, events]);

  // null (not just "all") when unfiltered, so filteredRequests/filteredEvents
  // below can tell "no county filter applied" apart from "this county has
  // zero matching events" without an extra branch at each call site.
  const eventIdsInCounty = useMemo(() => {
    if (county === "all") return null;
    const venueIds = new Set(venues.filter(v => v.county === county).map(v => v.id));
    return new Set(events.filter(e => venueIds.has(e.venueId)).map(e => e.id));
  }, [county, venues, events]);

  // null (not just "no range picked") when unfiltered, same reasoning as
  // eventIdsInCounty above - lets filteredEvents tell "no date filter" apart
  // from "no events have a request in this range" without an extra branch.
  const eventIdsInDateRange = useMemo(() => {
    if (!dateRange?.from || !dateRange.to) return null;
    const { from, to } = dateRange;
    return new Set(
      requests
        .filter(r => isWithinInterval(new Date(r.date), { start: from, end: to }))
        .map(r => r.eventId)
    );
  }, [dateRange, requests]);

  const filteredRequests = useMemo(() => {
    let data = requests;
    if (eventIdsOfType) data = data.filter(r => eventIdsOfType.has(r.eventId));
    if (eventIdsInCounty) data = data.filter(r => eventIdsInCounty.has(r.eventId));
    if (dateRange?.from && dateRange.to) {
      const { from, to } = dateRange;
      data = data.filter(r => isWithinInterval(new Date(r.date), { start: from, end: to }));
    }
    return data;
  }, [requests, eventIdsOfType, eventIdsInCounty, dateRange]);
  const filteredEvents = useMemo(() => {
    let data = events;
    if (eventIdsOfType) data = data.filter(e => eventIdsOfType.has(e.id));
    if (eventIdsInCounty) data = data.filter(e => eventIdsInCounty.has(e.id));
    if (eventIdsInDateRange) data = data.filter(e => eventIdsInDateRange.has(e.id));
    return data;
  }, [events, eventIdsOfType, eventIdsInCounty, eventIdsInDateRange]);

  if (loading) {
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
            <Label htmlFor="insights-county">County</Label>
            <Select value={county} onValueChange={setCounty}>
              <SelectTrigger id="insights-county"><SelectValue placeholder="All Counties" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Counties</SelectItem>
                {countyOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                <Calendar initialFocus mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                {dateRange && (
                  <div className="border-t p-2">
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateRange(undefined)}>
                      Clear dates
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </InsightCard>

      <ParticipantLookup requests={filteredRequests} clients={clients} />

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-2">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="staff-employer">Staff & Employer</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
            <TabsTrigger value="cross-client">Cross-Client</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <OverviewSection requests={filteredRequests} events={filteredEvents} participants={participants} clients={clients} />
        </TabsContent>
        <TabsContent value="financial">
          <FinancialSection requests={filteredRequests} />
        </TabsContent>
        <TabsContent value="staff-employer">
          <StaffEmployerSection requests={filteredRequests} participants={participants} />
        </TabsContent>
        <TabsContent value="training">
          <TrainingSection requests={filteredRequests} events={filteredEvents} venues={venues} />
        </TabsContent>
        <TabsContent value="cross-client">
          <CrossClientSection requests={filteredRequests} events={filteredEvents} participants={participants} clients={clients} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
