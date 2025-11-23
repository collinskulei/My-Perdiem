
'use client';

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
} from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

export function AdminSidebarNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'requests';

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
        <Link href="/admin" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/admin', null)}>
            <Home />
            Dashboard
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=analytics" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/admin', 'analytics')}>
            <BarChart />
            Analytics
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=requests" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/admin', 'requests')}>
            <ClipboardList />
            Per Diem Requests
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=events" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/admin', 'events')}>
            <CalendarDays />
            Events
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=checkins" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/admin', 'checkins')}>
            <ClipboardCheck />
            Event Check-ins
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=participants" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/admin', 'participants')}>
            <Users />
            Participants
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/admin?tab=venues" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/admin', 'venues')}>
            <MapPin />
            Venues
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href="/admin?tab=reports" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/admin', 'reports')}>
            <FileText />
            Reports
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/profile" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/profile', null)}>
            <User />
            Profile
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
