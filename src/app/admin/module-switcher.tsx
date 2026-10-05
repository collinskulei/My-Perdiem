/**
 * @file Top-of-sidebar navigation between a portal's Home (overall
 * Insights) and each module the client has switched on. The module's own
 * tabs render below it (AdminSidebarNavigation for Per Diem,
 * SalarySidebarNavigation for Salary Payments).
 */
"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { MODULES, homePath, modulePath, type ModuleKey } from "@/lib/modules";
import { useAdminTab } from "./admin-tab-context";
import type { PortalInfo } from "./portal-access";

export type ActiveModule = "home" | ModuleKey;

export function ModuleSwitcher({ portal, active }: { portal: PortalInfo; active: ActiveModule }) {
  const { setActiveTab } = useAdminTab();
  return (
    <>
      <SidebarGroup className="pb-0">
        <SidebarGroupLabel>{portal.clientName ?? "Modules"}</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href={homePath(portal.base)} onClick={() => setActiveTab("overview")}>
              <SidebarMenuButton isActive={active === "home"}>
                <LayoutGrid />
                Home
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          {portal.enabledModules.map((key) => {
            const m = MODULES[key];
            const Icon = m.icon;
            return (
              <SidebarMenuItem key={key}>
                <Link href={modulePath(portal.base, key)} onClick={() => setActiveTab("overview")}>
                  <SidebarMenuButton isActive={active === key}>
                    <Icon />
                    {m.label}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
      {active !== "home" && <SidebarSeparator />}
    </>
  );
}
