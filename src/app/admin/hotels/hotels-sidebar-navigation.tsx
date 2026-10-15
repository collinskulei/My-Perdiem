/**
 * @file Hotel Bookings module's sidebar tabs - same instant-switch pattern
 * as the Salary sidebar (salary-sidebar-navigation.tsx): setActiveTab on
 * click, the Link updates the URL in the background.
 */
"use client";

import Link from "next/link";
import { LayoutDashboard, Receipt, Hotel, Upload, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAdminTab } from "../admin-tab-context";
import { usePortal } from "../portal-context";
import { isSuperAdminTier } from "../salary/salary-sidebar-navigation";

export const HOTEL_TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "payments", label: "Payments", icon: Receipt },
  { key: "hotels", label: "Hotels", icon: Hotel },
  // Uploads are done by Super Admins for now - hidden from Organization Admins.
  { key: "upload", label: "Upload", icon: Upload, superAdminOnly: true },
] as const;

export type HotelTab = (typeof HOTEL_TABS)[number]["key"];

export function HotelsSidebarNavigation({ basePath }: { basePath: string }) {
  const { activeTab, setActiveTab } = useAdminTab();
  const pathname = usePathname();
  const portal = usePortal();

  return (
    <SidebarMenu>
      {HOTEL_TABS.filter((t) => !("superAdminOnly" in t) || isSuperAdminTier(portal?.tier)).map((t) => {
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
