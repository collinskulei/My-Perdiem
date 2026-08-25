/**
 * @file Super/Master Admin "Insights" tab (see docs/MILESTONE_HANDOFF.md) -
 * a comprehensive analytics view across every client, distinct from the
 * simpler per-client "Analytics" tab every admin tier already sees. Gated
 * to isMultiClientAdmin by the caller (admin-dashboard.tsx), same as the
 * "Clients"/"Submissions" tabs.
 */
"use client";

import { useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { PerdiemRequest, AppEvent, Participant, Venue, Client } from "@/lib/data";
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
  // "Event type" - there's no dedicated type/category field on events, so
  // this filters by the event's own name (e.g. "TOT", "EUT - County
  // Sub-Counties", "Workshop/Conference - Sarova Stanley"), same approach
  // as the equivalent Reports tab filter. Applied once here and cascaded
  // to every sub-section + the participant lookup below, rather than each
  // section needing its own copy of this filter.
  const [eventType, setEventType] = useState("all");
  // County isn't a field on events/requests directly - it lives on the
  // venue (see Venue.county), so this resolves county -> matching venues ->
  // events held at those venues -> requests for those events, same
  // indirection the Reports tab's County filter already uses.
  const [county, setCounty] = useState("all");

  const eventTypeOptions = useMemo(
    () => Array.from(new Set(requests.map(r => r.eventName).filter((e): e is string => !!e))).sort(),
    [requests]
  );
  const countyOptions = useMemo(
    () => Array.from(new Set(venues.map(v => v.county).filter((c): c is string => !!c))).sort(),
    [venues]
  );

  // null (not just "all") when unfiltered, so filteredRequests/filteredEvents
  // below can tell "no county filter applied" apart from "this county has
  // zero matching events" without an extra branch at each call site.
  const eventIdsInCounty = useMemo(() => {
    if (county === "all") return null;
    const venueIds = new Set(venues.filter(v => v.county === county).map(v => v.id));
    return new Set(events.filter(e => venueIds.has(e.venueId)).map(e => e.id));
  }, [county, venues, events]);

  const filteredRequests = useMemo(() => {
    let data = requests;
    if (eventType !== "all") data = data.filter(r => r.eventName === eventType);
    if (eventIdsInCounty) data = data.filter(r => eventIdsInCounty.has(r.eventId));
    return data;
  }, [requests, eventType, eventIdsInCounty]);
  const filteredEvents = useMemo(() => {
    let data = events;
    if (eventType !== "all") data = data.filter(e => e.name === eventType);
    if (eventIdsInCounty) data = data.filter(e => eventIdsInCounty.has(e.id));
    return data;
  }, [events, eventType, eventIdsInCounty]);

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
                {eventTypeOptions.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
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
