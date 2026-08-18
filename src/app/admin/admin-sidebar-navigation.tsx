
'use client';

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Home,
  User,
  ClipboardList,
  CalendarDays,
  ClipboardCheck,
  Users,
  MapPin,
  FileText,
  BarChart,
  Sparkles,
  ShieldCheck,
  Building2,
  FileStack,
} from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import * as supabaseDb from "@/lib/supabase/database";
import type { AccessTier } from "@/lib/data";

/**
 * The sidebar is the only navigation surface (see docs/MILESTONE_HANDOFF.md
 * - the horizontal TabsList that used to duplicate this list in
 * admin-dashboard.tsx was removed). "Event Check-ins" nests under "Events",
 * "Analytics"/"Insights" under "Reports", and "Clients"/"Submissions" under
 * "Manage" via three independent single-item Accordions (one per group,
 * each self-contained inside its own SidebarMenuItem so SidebarMenu's <ul>
 * still gets valid <li> children directly - an Accordion Root sitting
 * between <ul> and <li> would break that). Each group defaults open
 * (`defaultValue` = its own value) rather than collapsed - AccordionContent
 * unmounts its children when closed (no forceMount), and the "Guide me"
 * tour (see admin-tour.ts) needs every data-tour target present in the DOM
 * without first expanding anything.
 */
export function AdminSidebarNavigation({ basePath = "/admin" }: { basePath?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'requests';
  const [accessTier, setAccessTier] = useState<AccessTier | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        supabaseDb.getParticipantById(session.user.id).then((p) => setAccessTier(p?.accessTier ?? null));
      } else {
        setAccessTier(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const canManage = accessTier !== null && accessTier !== 'client_user';
  const isMultiClientAdmin = accessTier === 'super_admin' || accessTier === 'master_admin';

  const isLinkActive = (path: string, tab: string | null) => {
    if (path !== basePath) {
      return pathname === path;
    }
    // Special handling for the main dashboard link
    if (tab === null) {
      return pathname === basePath && !searchParams.has('tab');
    }
    return pathname === path && activeTab === tab;
  }

  const eventsGroupActive = activeTab === 'events' || activeTab === 'checkins';
  const reportsGroupActive = ['reports', 'analytics', 'insights'].includes(activeTab);
  const manageGroupActive = ['management', 'clients', 'submissions'].includes(activeTab);

  const groupTriggerClass = (active: boolean) => cn(
    "flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline py-0 [&>svg:last-child]:h-4 [&>svg:last-child]:w-4",
    active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Link href={basePath}>
          <SidebarMenuButton isActive={isLinkActive(basePath, null)}>
            <Home />
            Dashboard
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href={`${basePath}?tab=requests`}>
          <SidebarMenuButton isActive={isLinkActive(basePath, 'requests')} data-tour="tab-requests">
            <ClipboardList />
            Per Diem Requests
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>

      {/* Events group: Events, Event Check-ins */}
      <SidebarMenuItem>
        <Accordion type="single" collapsible defaultValue="events">
          <AccordionItem value="events" className="border-none">
            <AccordionTrigger data-tour="tab-events-group" className={groupTriggerClass(eventsGroupActive)}>
              <CalendarDays className="h-4 w-4 shrink-0" />
              Events
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isLinkActive(basePath, 'events')}>
                    <Link href={`${basePath}?tab=events`} data-tour="tab-events">
                      <CalendarDays />
                      Events
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isLinkActive(basePath, 'checkins')}>
                    <Link href={`${basePath}?tab=checkins`} data-tour="tab-checkins">
                      <ClipboardCheck />
                      Event Check-ins
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <Link href={`${basePath}?tab=participants`}>
          <SidebarMenuButton isActive={isLinkActive(basePath, 'participants')} data-tour="tab-participants">
            <Users />
            Participants
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href={`${basePath}?tab=venues`}>
          <SidebarMenuButton isActive={isLinkActive(basePath, 'venues')} data-tour="tab-venues">
            <MapPin />
            Venues
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>

      {/* Reports group: Reports, Analytics, Insights */}
      <SidebarMenuItem>
        <Accordion type="single" collapsible defaultValue="reports">
          <AccordionItem value="reports" className="border-none">
            <AccordionTrigger data-tour="tab-reports-group" className={groupTriggerClass(reportsGroupActive)}>
              <FileText className="h-4 w-4 shrink-0" />
              Reports
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isLinkActive(basePath, 'reports')}>
                    <Link href={`${basePath}?tab=reports`} data-tour="tab-reports">
                      <FileText />
                      Reports
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isLinkActive(basePath, 'analytics')}>
                    <Link href={`${basePath}?tab=analytics`} data-tour="tab-analytics">
                      <BarChart />
                      Analytics
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                {isMultiClientAdmin && (
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={isLinkActive(basePath, 'insights')}>
                      <Link href={`${basePath}?tab=insights`} data-tour="tab-insights">
                        <Sparkles />
                        Insights
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SidebarMenuItem>

      {accessTier === 'client_admin' && (
        <SidebarMenuItem>
          <Link href={`${basePath}?tab=documents`}>
            <SidebarMenuButton isActive={isLinkActive(basePath, 'documents')} data-tour="tab-documents">
              <FileStack />
              Documents
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      )}

      {/* Manage group: Manage, Clients, Submissions */}
      {canManage && (
        <SidebarMenuItem>
          <Accordion type="single" collapsible defaultValue="manage">
            <AccordionItem value="manage" className="border-none">
              <AccordionTrigger data-tour="tab-manage-group" className={groupTriggerClass(manageGroupActive)}>
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Manage
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={isLinkActive(basePath, 'management')}>
                      <Link href={`${basePath}?tab=management`} data-tour="tab-management">
                        <ShieldCheck />
                        Manage
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  {isMultiClientAdmin && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isLinkActive(basePath, 'clients')}>
                        <Link href={`${basePath}?tab=clients`} data-tour="tab-clients">
                          <Building2 />
                          Clients
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                  {isMultiClientAdmin && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isLinkActive(basePath, 'submissions')}>
                        <Link href={`${basePath}?tab=submissions`} data-tour="tab-submissions">
                          <FileStack />
                          Submissions
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                </SidebarMenuSub>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SidebarMenuItem>
      )}

      <SidebarMenuItem>
        <Link href="/profile">
          <SidebarMenuButton isActive={isLinkActive('/profile', null)}>
            <User />
            Profile
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
