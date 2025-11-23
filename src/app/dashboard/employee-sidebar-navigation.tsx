
'use client';

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
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
        <Link href="/dashboard" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/dashboard', 'events')}>
            <Home />
            Dashboard
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
        <SidebarMenuItem>
        <Link href="/dashboard?tab=events" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/dashboard', 'events')}>
            <CalendarDays />
            My Events
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href="/dashboard?tab=checkins" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/dashboard', 'checkins')}>
            <ClipboardCheck />
            My Check-ins
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href="/dashboard?tab=requests" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/dashboard', 'requests')}>
            <ClipboardList />
            My Per Diem Requests
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href="/dashboard?tab=analytics" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/dashboard', 'analytics')}>
            <BarChart />
            My Analytics
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href="/profile" passHref legacyBehavior>
          <SidebarMenuButton as="a" isActive={isLinkActive('/profile')}>
            <User />
            Profile
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
