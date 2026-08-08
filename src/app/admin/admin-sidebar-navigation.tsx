
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
} from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { supabase } from "@/lib/supabase/client";
import * as supabaseDb from "@/lib/supabase/database";
import type { AccessTier } from "@/lib/data";

export function AdminSidebarNavigation() {
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

  const isLinkActive = (path: string, tab: string | null) => {
    if (path !== '/admin') {
      return pathname === path;
    }
    // Special handling for the main dashboard link
    if (tab === null) {
      return pathname === '/admin' && !searchParams.has('tab');
    }
    return pathname === path && activeTab === tab;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Link href="/admin">
          <SidebarMenuButton isActive={isLinkActive('/admin', null)}>
            <Home />
            Dashboard
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=analytics">
          <SidebarMenuButton isActive={isLinkActive('/admin', 'analytics')}>
            <BarChart />
            Analytics
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=requests">
          <SidebarMenuButton isActive={isLinkActive('/admin', 'requests')}>
            <ClipboardList />
            Per Diem Requests
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=events">
          <SidebarMenuButton isActive={isLinkActive('/admin', 'events')}>
            <CalendarDays />
            Events
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=checkins">
          <SidebarMenuButton isActive={isLinkActive('/admin', 'checkins')}>
            <ClipboardCheck />
            Event Check-ins
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=participants">
          <SidebarMenuButton isActive={isLinkActive('/admin', 'participants')}>
            <Users />
            Participants
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=venues">
          <SidebarMenuButton isActive={isLinkActive('/admin', 'venues')}>
            <MapPin />
            Venues
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href="/admin?tab=reports">
          <SidebarMenuButton isActive={isLinkActive('/admin', 'reports')}>
            <FileText />
            Reports
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      {canManage && (
        <SidebarMenuItem>
          <Link href="/admin?tab=management">
            <SidebarMenuButton isActive={isLinkActive('/admin', 'management')}>
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
