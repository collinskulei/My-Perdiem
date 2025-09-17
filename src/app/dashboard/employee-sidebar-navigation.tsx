
'use client';

import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  User,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  BarChart,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

export function EmployeeSidebarNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab');

  const isLinkActive = (path: string, tab?: string | null) => {
    const isPathMatch = pathname === path;
    
    // For specific pages like /profile
    if (path !== '/dashboard') {
        return isPathMatch;
    }

    // For dashboard tabs
    if (tab) {
        return isPathMatch && activeTab === tab;
    }

    // For the main dashboard link (Home/Events). It should be active if we are on /dashboard and there's no tab, or if tab is 'events'.
    return isPathMatch && (activeTab === null || activeTab === 'events');
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton href="/dashboard" isActive={isLinkActive('/dashboard')}>
          <Home />
          Dashboard
        </SidebarMenuButton>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <SidebarMenuButton href="/dashboard?tab=events" isActive={isLinkActive('/dashboard', 'events')}>
          <CalendarDays />
          My Events
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton href="/dashboard?tab=checkins" isActive={isLinkActive('/dashboard', 'checkins')}>
          <ClipboardCheck />
          My Check-ins
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton href="/dashboard?tab=requests" isActive={isLinkActive('/dashboard', 'requests')}>
          <ClipboardList />
          My Per Diem Requests
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton href="/dashboard?tab=analytics" isActive={isLinkActive('/dashboard', 'analytics')}>
          <BarChart />
          My Analytics
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton href="/profile" isActive={isLinkActive('/profile')}>
          <User />
          Profile
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
