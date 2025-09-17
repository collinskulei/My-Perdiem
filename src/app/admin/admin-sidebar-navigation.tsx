
'use client';

import { usePathname, useSearchParams } from "next/navigation";
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
        <SidebarMenuButton href="/admin" isActive={isLinkActive('/admin', null)}>
          <Home />
          Dashboard
        </SidebarMenuButton>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <SidebarMenuButton href="/admin?tab=analytics" isActive={isLinkActive('/admin', 'analytics')}>
          <BarChart />
          Analytics
        </SidebarMenuButton>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <SidebarMenuButton href="/admin?tab=requests" isActive={isLinkActive('/admin', 'requests')}>
          <ClipboardList />
          Per Diem Requests
        </SidebarMenuButton>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <SidebarMenuButton href="/admin?tab=events" isActive={isLinkActive('/admin', 'events')}>
          <CalendarDays />
          Events
        </SidebarMenuButton>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <SidebarMenuButton href="/admin?tab=checkins" isActive={isLinkActive('/admin', 'checkins')}>
          <ClipboardCheck />
          Event Check-ins
        </SidebarMenuButton>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <SidebarMenuButton href="/admin?tab=employees" isActive={isLinkActive('/admin', 'employees')}>
          <Users />
          Employees
        </SidebarMenuButton>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <SidebarMenuButton href="/admin?tab=venues" isActive={isLinkActive('/admin', 'venues')}>
          <MapPin />
          Venues
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton href="/admin?tab=reports" isActive={isLinkActive('/admin', 'reports')}>
          <FileText />
          Reports
        </SidebarMenuButton>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <SidebarMenuButton href="/profile" isActive={isLinkActive('/profile', null)}>
          <User />
          Profile
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
