/**
 * @file Super/Master Admin Home's sidebar items, under the module switcher:
 * the platform-wide Manage group (Manage, Clients, Submissions - rendered
 * by home-manage.tsx) and Profile. These used to sit in the Per Diem menu
 * (admin-sidebar-navigation.tsx), which now hides them for these tiers.
 * Same Accordion pattern and data-tour targets as that menu.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileStack, ShieldCheck, User } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useAdminTab } from "./admin-tab-context";

/** Tabs that moved from the Per Diem dashboard to Home for Super/Master
 * Admins - admin-dashboard.tsx redirects old links to them here. */
export const HOME_ADMIN_TABS = ["management", "clients", "submissions"] as const;

export function isHomeAdminTab(tab: string): boolean {
  return (HOME_ADMIN_TABS as readonly string[]).includes(tab);
}

const ITEMS = [
  { tab: "management", label: "Manage", icon: ShieldCheck },
  { tab: "clients", label: "Clients", icon: Building2 },
  { tab: "submissions", label: "Submissions", icon: FileStack },
] as const;

export function HomeSidebarNavigation({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const { activeTab, setActiveTab } = useAdminTab();
  const onHome = pathname === basePath;
  const groupActive = onHome && isHomeAdminTab(activeTab);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Accordion type="single" collapsible defaultValue="manage">
          <AccordionItem value="manage" className="border-none">
            <AccordionTrigger
              data-tour="tab-manage-group"
              className={cn(
                "flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline py-0 [&>svg:last-child]:h-4 [&>svg:last-child]:w-4",
                groupActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Manage
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SidebarMenuSub>
                {ITEMS.map(({ tab, label, icon: Icon }) => (
                  <SidebarMenuSubItem key={tab}>
                    <SidebarMenuSubButton asChild isActive={onHome && activeTab === tab}>
                      <Link href={`${basePath}?tab=${tab}`} data-tour={`tab-${tab}`} onClick={() => setActiveTab(tab)}>
                        <Icon />
                        {label}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SidebarMenuItem>
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
