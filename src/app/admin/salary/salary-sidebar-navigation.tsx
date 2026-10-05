/**
 * @file Salary Payments module's sidebar tabs - same instant-switch pattern
 * as the Per Diem sidebar (admin-sidebar-navigation.tsx /
 * admin-tab-context.tsx): setActiveTab on click, the Link updates the URL
 * in the background. "Employers & Templates" is Super Admin and above.
 */
"use client";

import Link from "next/link";
import { LayoutDashboard, CalendarRange, Users, Landmark, Upload, Settings2, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAdminTab } from "../admin-tab-context";
import { usePortal } from "../portal-context";

export const SALARY_TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "runs", label: "Monthly Runs", icon: CalendarRange },
  { key: "employees", label: "Employees", icon: Users },
  { key: "statutory", label: "Statutory", icon: Landmark },
  { key: "upload", label: "Upload", icon: Upload },
  { key: "setup", label: "Employers & Templates", icon: Settings2, superAdminOnly: true },
] as const;

export type SalaryTab = (typeof SALARY_TABS)[number]["key"];

export function isSuperAdminTier(tier: string | undefined | null): boolean {
  return tier === "super_admin" || tier === "master_admin";
}

export function SalarySidebarNavigation({ basePath }: { basePath: string }) {
  const { activeTab, setActiveTab } = useAdminTab();
  const portal = usePortal();
  const pathname = usePathname();
  const canSetup = isSuperAdminTier(portal?.tier);

  return (
    <SidebarMenu>
      {SALARY_TABS.filter((t) => !("superAdminOnly" in t) || canSetup).map((t) => {
        const Icon = t.icon;
        const href = t.key === "overview" ? basePath : `${basePath}?tab=${t.key}`;
        return (
          <SidebarMenuItem key={t.key}>
            <Link href={href} onClick={() => setActiveTab(t.key)}>
              <SidebarMenuButton isActive={pathname === basePath && activeTab === t.key}>
                <Icon />
                {t.label}
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        );
      })}
      <SidebarMenuItem>
        <Link href="/profile">
          <SidebarMenuButton isActive={pathname === "/profile"}>
            <User />
            Profile
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
