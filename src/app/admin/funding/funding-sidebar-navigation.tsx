/**
 * @file Funding & Refunds module's sidebar tabs - same instant-switch
 * pattern as the Hotel Bookings sidebar (hotels-sidebar-navigation.tsx).
 */
"use client";

import Link from "next/link";
import { LayoutDashboard, Receipt, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAdminTab } from "../admin-tab-context";

export const FUNDING_TABS = [
  { key: "overview", label: "Reconciliation", icon: LayoutDashboard },
  { key: "receipts", label: "Receipts", icon: Receipt },
] as const;

export function FundingSidebarNavigation({ basePath }: { basePath: string }) {
  const { activeTab, setActiveTab } = useAdminTab();
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {FUNDING_TABS.map((t) => {
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
