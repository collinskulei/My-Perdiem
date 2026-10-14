/**
 * @file Travel & Ground Transfers module's sidebar tabs - same instant-switch pattern
 * as the Salary sidebar (salary-sidebar-navigation.tsx): setActiveTab on
 * click, the Link updates the URL in the background.
 */
"use client";

import Link from "next/link";
import { LayoutDashboard, Receipt, Upload, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAdminTab } from "../admin-tab-context";

export const TRAVEL_TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "payments", label: "Payments", icon: Receipt },
  { key: "upload", label: "Upload", icon: Upload },
] as const;

export type TravelTab = (typeof TRAVEL_TABS)[number]["key"];

export function TravelSidebarNavigation({ basePath }: { basePath: string }) {
  const { activeTab, setActiveTab } = useAdminTab();
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {TRAVEL_TABS.map((t) => {
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
