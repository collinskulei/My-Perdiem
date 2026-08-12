
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
  ShieldCheck,
  Building2,
  FileStack,
} from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { supabase } from "@/lib/supabase/client";
import * as supabaseDb from "@/lib/supabase/database";
import type { AccessTier } from "@/lib/data";

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
        <Link href={`${basePath}?tab=analytics`}>
          <SidebarMenuButton isActive={isLinkActive(basePath, 'analytics')}>
            <BarChart />
            Analytics
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href={`${basePath}?tab=requests`}>
          <SidebarMenuButton isActive={isLinkActive(basePath, 'requests')}>
            <ClipboardList />
            Per Diem Requests
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href={`${basePath}?tab=events`}>
          <SidebarMenuButton isActive={isLinkActive(basePath, 'events')}>
            <CalendarDays />
            Events
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href={`${basePath}?tab=checkins`}>
          <SidebarMenuButton isActive={isLinkActive(basePath, 'checkins')}>
            <ClipboardCheck />
            Event Check-ins
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href={`${basePath}?tab=participants`}>
          <SidebarMenuButton isActive={isLinkActive(basePath, 'participants')}>
            <Users />
            Participants
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href={`${basePath}?tab=venues`}>
          <SidebarMenuButton isActive={isLinkActive(basePath, 'venues')}>
            <MapPin />
            Venues
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href={`${basePath}?tab=reports`}>
          <SidebarMenuButton isActive={isLinkActive(basePath, 'reports')}>
            <FileText />
            Reports
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      {isMultiClientAdmin && (
        <SidebarMenuItem>
          <Link href={`${basePath}?tab=clients`}>
            <SidebarMenuButton isActive={isLinkActive(basePath, 'clients')}>
              <Building2 />
              Clients
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      )}
      {accessTier === 'client_admin' && (
        <SidebarMenuItem>
          <Link href={`${basePath}?tab=documents`}>
            <SidebarMenuButton isActive={isLinkActive(basePath, 'documents')}>
              <FileStack />
              Documents
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      )}
      {isMultiClientAdmin && (
        <SidebarMenuItem>
          <Link href={`${basePath}?tab=submissions`}>
            <SidebarMenuButton isActive={isLinkActive(basePath, 'submissions')}>
              <FileStack />
              Submissions
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      )}
      {canManage && (
        <SidebarMenuItem>
          <Link href={`${basePath}?tab=management`}>
            <SidebarMenuButton isActive={isLinkActive(basePath, 'management')}>
              <ShieldCheck />
              Manage
            </SidebarMenuButton>
          </Link>
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
