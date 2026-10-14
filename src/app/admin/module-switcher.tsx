/**
 * @file Top-of-sidebar navigation between a portal's Home (overall
 * Insights) and each module the client has switched on. The module's own
 * tabs render below it (AdminSidebarNavigation for Per Diem,
 * SalarySidebarNavigation for Salary Payments, ...), and for Super/Master
 * Admins Home has its own items too (HomeSidebarNavigation). A module
 * group (Other Project Facilitations) is one entry with its enabled
 * submodules listed under it.
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { GROUPS, MODULES, groupPath, homePath, moduleEntries, modulePath, type GroupKey, type ModuleKey } from "@/lib/modules";
import { useAdminTab } from "./admin-tab-context";
import { isHomeAdminTab } from "./home-sidebar-navigation";
import type { PortalInfo } from "./portal-access";

export type ActiveModule = "home" | ModuleKey | GroupKey;

export function ModuleSwitcher({ portal, active }: { portal: PortalInfo; active: ActiveModule }) {
  const { activeTab, setActiveTab } = useAdminTab();
  const homeHasItems = portal.kind !== "client";
  return (
    <>
      <SidebarGroup className="pb-0">
        <SidebarGroupLabel>{portal.clientName ?? "Modules"}</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href={homePath(portal.base)} onClick={() => setActiveTab("overview")}>
              <SidebarMenuButton isActive={active === "home" && !isHomeAdminTab(activeTab)}>
                <LayoutGrid />
                Home
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          {moduleEntries(portal.enabledModules).map((entry) => {
            if (entry.kind === "module") {
              const m = MODULES[entry.key];
              const Icon = m.icon;
              return (
                <SidebarMenuItem key={entry.key}>
                  <Link href={modulePath(portal.base, entry.key)} onClick={() => setActiveTab("overview")}>
                    <SidebarMenuButton isActive={active === entry.key}>
                      <Icon />
                      {m.label}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              );
            }
            const g = GROUPS[entry.key];
            const Icon = g.icon;
            return (
              <SidebarMenuItem key={entry.key}>
                <Link href={groupPath(portal.base, entry.key)} onClick={() => setActiveTab("overview")}>
                  <SidebarMenuButton isActive={active === entry.key}>
                    <Icon />
                    {g.label}
                  </SidebarMenuButton>
                </Link>
                <SidebarMenuSub>
                  {entry.modules.map((key) => {
                    const SubIcon = MODULES[key].icon;
                    return (
                      <SidebarMenuSubItem key={key}>
                        <SidebarMenuSubButton asChild isActive={active === key}>
                          <Link href={modulePath(portal.base, key)} onClick={() => setActiveTab("overview")}>
                            <SubIcon />
                            <span>{MODULES[key].label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
      {((active !== "home" && active !== "facilitations") || (active === "home" && homeHasItems)) && <SidebarSeparator />}
    </>
  );
}
