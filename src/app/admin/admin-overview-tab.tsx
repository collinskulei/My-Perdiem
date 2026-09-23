/**
 * @file Admin dashboard landing page - a grid of clickable summary cards,
 * one per sidebar section (see admin-sidebar-navigation.tsx), each showing a
 * quick stat and linking into that tab. Replaces the old default of landing
 * directly on the raw Per Diem Requests table with no orientation at all.
 *
 * Stats here are computed client-side from data the dashboard already has
 * in memory (same pattern Insights already uses) - fine at today's data
 * volume, but this is the natural first place to move to server-side
 * aggregation if/when that work happens, since a landing page only ever
 * needs small counts/sums, never the full row set.
 */
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { isPast, endOfDay, parseISO } from "date-fns";
import {
  ClipboardList, CalendarDays, ClipboardCheck, Users, MapPin,
  FileText, BarChart, Sparkles, ShieldCheck, Building2, FileStack,
} from "lucide-react";
import type { ComponentType } from "react";
import type { PerdiemRequest, AppEvent, Participant, Venue, Client, Document, AccessTier } from "@/lib/data";
import { isTransacted } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { InsightCard, useCountUp } from "./insights/shared";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function isEventUpcoming(event: AppEvent): boolean {
  const lastDate = event.eventDates?.length ? parseISO(event.eventDates[event.eventDates.length - 1]) : new Date(0);
  return !isPast(endOfDay(lastDate));
}

function OverviewCard({ icon: Icon, label, value, subtitle, formatter, href, onNavigate, delay = 0 }: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  subtitle?: string;
  formatter?: (v: number) => string;
  href: string;
  onNavigate: () => void;
  delay?: number;
}) {
  const animated = useCountUp(value);
  const display = formatter ? formatter(animated) : Math.round(animated).toLocaleString();
  return (
    <Link href={href} onClick={onNavigate} className="block">
      <InsightCard
        className="cursor-pointer hover:border-primary/50"
        style={{ animationDelay: `${delay}ms` }}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className="h-4 w-4 shrink-0 text-primary" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl md:text-3xl font-bold truncate tabular-nums bg-gradient-to-r from-primary to-[#3b82f6] bg-clip-text text-transparent" title={display}>
            {display}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </CardContent>
      </InsightCard>
    </Link>
  );
}

export function AdminOverviewTab({
  requests, events, participants, venues, clients, documents, currentAdmin, isMultiClientAdmin, basePath, setActiveTab,
}: {
  requests: PerdiemRequest[];
  events: AppEvent[];
  participants: Participant[];
  venues: Venue[];
  clients: Client[];
  documents: Document[];
  currentAdmin: { accessTier: AccessTier; clientId: string | null } | null;
  isMultiClientAdmin: boolean;
  basePath: string;
  setActiveTab: (tab: string) => void;
}) {
  const stats = useMemo(() => {
    const pendingRequests = requests.filter(r => r.status === "Pending").length;
    const upcomingEvents = events.filter(isEventUpcoming).length;
    const totalCheckedIn = events.reduce((sum, e) => sum + Object.keys(e.checkedInParticipants ?? {}).length, 0);
    const nonAdminParticipants = participants.filter(p => p.accessTier === "client_user").length;
    const totalAdmins = participants.filter(p => p.accessTier !== "client_user").length;
    const totalPaidOut = requests.filter(isTransacted).reduce((s, r) => s + r.totalPerdiem, 0);
    const clientDocuments = currentAdmin?.clientId
      ? documents.filter(d => d.clientId === currentAdmin.clientId).length
      : documents.length;
    return { pendingRequests, upcomingEvents, totalCheckedIn, nonAdminParticipants, totalAdmins, totalPaidOut, clientDocuments };
  }, [requests, events, participants, documents, currentAdmin]);

  const canManage = currentAdmin != null && currentAdmin.accessTier !== "client_user";
  const isClientAdmin = currentAdmin?.accessTier === "client_admin";

  const go = (tab: string) => () => setActiveTab(tab);
  const link = (tab: string) => `${basePath}?tab=${tab}`;

  let delay = 0;
  const next = () => (delay += 50);

  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <OverviewCard
        icon={ClipboardList} label="Per Diem Requests" value={stats.pendingRequests}
        subtitle={`${requests.length.toLocaleString()} total`}
        href={link("requests")} onNavigate={go("requests")} delay={next()}
      />
      <OverviewCard
        icon={CalendarDays} label="Events" value={stats.upcomingEvents}
        subtitle={`${events.length.toLocaleString()} total`}
        href={link("events")} onNavigate={go("events")} delay={next()}
      />
      <OverviewCard
        icon={ClipboardCheck} label="Event Check-ins" value={stats.totalCheckedIn}
        subtitle="participants checked in"
        href={link("checkins")} onNavigate={go("checkins")} delay={next()}
      />
      <OverviewCard
        icon={Users} label="Participants" value={stats.nonAdminParticipants}
        href={link("participants")} onNavigate={go("participants")} delay={next()}
      />
      <OverviewCard
        icon={MapPin} label="Venues" value={venues.length}
        href={link("venues")} onNavigate={go("venues")} delay={next()}
      />
      <OverviewCard
        icon={FileText} label="Reports" value={requests.length}
        subtitle="total records"
        href={link("reports")} onNavigate={go("reports")} delay={next()}
      />
      <OverviewCard
        icon={BarChart} label="Analytics" value={stats.totalPaidOut} formatter={formatCurrency}
        subtitle="total paid out"
        href={link("analytics")} onNavigate={go("analytics")} delay={next()}
      />
      {isMultiClientAdmin && (
        <OverviewCard
          icon={Sparkles} label="Insights" value={clients.length}
          subtitle="clients on the platform"
          href={link("insights")} onNavigate={go("insights")} delay={next()}
        />
      )}
      {canManage && (
        <OverviewCard
          icon={ShieldCheck} label="Manage" value={stats.totalAdmins}
          subtitle="admin accounts"
          href={link("management")} onNavigate={go("management")} delay={next()}
        />
      )}
      {isMultiClientAdmin && (
        <OverviewCard
          icon={Building2} label="Clients" value={clients.length}
          href={link("clients")} onNavigate={go("clients")} delay={next()}
        />
      )}
      {isClientAdmin && (
        <OverviewCard
          icon={FileStack} label="Documents" value={stats.clientDocuments}
          href={link("documents")} onNavigate={go("documents")} delay={next()}
        />
      )}
      {isMultiClientAdmin && (
        <OverviewCard
          icon={FileStack} label="Submissions" value={documents.length}
          subtitle="across all clients"
          href={link("submissions")} onNavigate={go("submissions")} delay={next()}
        />
      )}
    </div>
  );
}
