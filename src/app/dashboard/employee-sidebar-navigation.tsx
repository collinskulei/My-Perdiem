
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
  const activeTab = searchParams.get('tab') || 'events';

  const isLinkActive = (path: string, tab?: string | null) => {
    const isPathMatch = pathname === path;
    if (!isPathMatch) return false;

    // For specific pages like /profile
    if (path !== '/dashboard') {
        return true;
    }
    
    // For dashboard tabs
    return activeTab === tab;
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton href="/dashboard" isActive={isLinkActive('/dashboard', 'events')}>
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
