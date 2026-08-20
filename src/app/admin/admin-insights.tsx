/**
 * @file Super/Master Admin "Insights" tab (see docs/MILESTONE_HANDOFF.md) -
 * a comprehensive analytics view across every client, distinct from the
 * simpler per-client "Analytics" tab every admin tier already sees. Gated
 * to isMultiClientAdmin by the caller (admin-dashboard.tsx), same as the
 * "Clients"/"Submissions" tabs.
 */
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PerdiemRequest, AppEvent, Participant, Venue, Client } from "@/lib/data";
import { InsightsLoadingSkeleton } from "./insights/shared";
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
  if (loading) {
    return <InsightsLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-[hsl(var(--chart-4))] bg-clip-text text-transparent">
          Insights
        </h2>
        <p className="text-muted-foreground">
          A full analytics view across every client - financials, staff/employer breakdowns, training trends, and cross-client comparisons.
        </p>
      </div>

      <ParticipantLookup requests={requests} clients={clients} />

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
          <OverviewSection requests={requests} events={events} participants={participants} clients={clients} />
        </TabsContent>
        <TabsContent value="financial">
          <FinancialSection requests={requests} />
        </TabsContent>
        <TabsContent value="staff-employer">
          <StaffEmployerSection requests={requests} participants={participants} />
        </TabsContent>
        <TabsContent value="training">
          <TrainingSection requests={requests} events={events} venues={venues} />
        </TabsContent>
        <TabsContent value="cross-client">
          <CrossClientSection requests={requests} events={events} participants={participants} clients={clients} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
