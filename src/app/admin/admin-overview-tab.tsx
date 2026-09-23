/**
 * @file Admin dashboard landing page - a grid of clickable summary cards,
 * one per sidebar section (see admin-sidebar-navigation.tsx), each showing a
 * quick stat and linking into that tab. Replaces the old default of landing
 * directly on the raw Per Diem Requests table with no orientation at all.
 *
 * The three requests-table-derived cards (Per Diem Requests, Reports,
 * Analytics) fetch their own numbers independently via
 * getPerdiemOverviewStats() - a small server-side aggregate (see migration
 * 0025_overview_stats_rpc.sql) - rather than waiting on the parent
 * dashboard's fetchAllData(), which pulls the *entire* perdiem_requests
 * table (29,000+ rows and growing) for the Requests/Reports/Analytics/
 * Insights tabs that genuinely need row-level data. That fetch alone can
 * take over a minute; this page shouldn't have to wait on it just to show
 * three numbers. Every other card here (Events, Participants, Venues,
 * Clients, Documents, ...) still reads from the parent's already-fetched
 * data, since those source tables are small and aren't the bottleneck.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isPast, endOfDay, parseISO } from "date-fns";
import {
  ClipboardList, CalendarDays, ClipboardCheck, Users, MapPin,
  FileText, BarChart, Sparkles, ShieldCheck, Building2, FileStack,
} from "lucide-react";
import type { ComponentType } from "react";
import type { AppEvent, Participant, Venue, Client, Document, AccessTier } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import * as supabaseDb from "@/lib/supabase/database";
import type { PerdiemOverviewStats } from "@/lib/supabase/database";
import { InsightCard, useCountUp } from "./insights/shared";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function isEventUpcoming(event: AppEvent): boolean {
  const lastDate = event.eventDates?.length ? parseISO(event.eventDates[event.eventDates.length - 1]) : new Date(0);
  return !isPast(endOfDay(lastDate));
}

function OverviewCard({ icon: Icon, label, value, subtitle, formatter, href, onNavigate, delay = 0, loading = false }: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  subtitle?: string;
  formatter?: (v: number) => string;
  href: string;
  onNavigate: () => void;
  delay?: number;
  loading?: boolean;
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
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-2xl md:text-3xl font-bold truncate tabular-nums bg-gradient-to-r from-primary to-[#3b82f6] bg-clip-text text-transparent" title={display}>
              {display}
            </p>
          )}
          {subtitle && !loading && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </CardContent>
      </InsightCard>
    </Link>
  );
}

export function AdminOverviewTab({
  events, participants, venues, clients, documents, currentAdmin, isMultiClientAdmin, basePath, setActiveTab,
}: {
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
  // Independent of the parent's fetchAllData() - see file comment. Scoped
  // to null (every client this caller's own RLS allows) rather than
  // currentAdmin.clientId - the RPC is security invoker, so a Client
  // Admin's tenant restriction is already enforced server-side either way,
  // and passing null here means the same call works unchanged for every
  // access tier instead of branching on one here too.
  const [requestStats, setRequestStats] = useState<PerdiemOverviewStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabaseDb.getPerdiemOverviewStats(null)
      .then((s) => { if (!cancelled) setRequestStats(s); })
      .catch((error) => console.error("Failed to load overview stats:", error));
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const upcomingEvents = events.filter(isEventUpcoming).length;
    const totalCheckedIn = events.reduce((sum, e) => sum + Object.keys(e.checkedInParticipants ?? {}).length, 0);
    const nonAdminParticipants = participants.filter(p => p.accessTier === "client_user").length;
    const totalAdmins = participants.filter(p => p.accessTier !== "client_user").length;
    const clientDocuments = currentAdmin?.clientId
      ? documents.filter(d => d.clientId === currentAdmin.clientId).length
      : documents.length;
    return { upcomingEvents, totalCheckedIn, nonAdminParticipants, totalAdmins, clientDocuments };
  }, [events, participants, documents, currentAdmin]);

  const canManage = currentAdmin != null && currentAdmin.accessTier !== "client_user";
  const isClientAdmin = currentAdmin?.accessTier === "client_admin";
  const requestsLoading = requestStats === null;

  const go = (tab: string) => () => setActiveTab(tab);
  const link = (tab: string) => `${basePath}?tab=${tab}`;

  let delay = 0;
  const next = () => (delay += 50);

  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <OverviewCard
        icon={ClipboardList} label="Per Diem Requests" value={requestStats?.pendingRequests ?? 0}
        subtitle={requestStats ? `${requestStats.totalRequests.toLocaleString()} total` : undefined}
        loading={requestsLoading}
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
        icon={FileText} label="Reports" value={requestStats?.totalRequests ?? 0}
        subtitle="total records"
        loading={requestsLoading}
        href={link("reports")} onNavigate={go("reports")} delay={next()}
      />
      <OverviewCard
        icon={BarChart} label="Analytics" value={requestStats?.totalPaidOut ?? 0} formatter={formatCurrency}
        subtitle="total paid out"
        loading={requestsLoading}
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
