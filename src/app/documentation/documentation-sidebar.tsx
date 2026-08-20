"use client";

import { useEffect, useState } from "react";
import {
  Rocket,
  UserRound,
  Building2,
  ShieldCheck,
  Crown,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type NavItem = { id: string; label: string };
type NavGroup = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    icon: Rocket,
    items: [
      { id: "what-is-my-perdiem", label: "What is My Perdiem?" },
      { id: "signing-in", label: "Signing In" },
      { id: "account-types", label: "Your Account Type" },
      { id: "theme-toggle", label: "Light & Dark Mode" },
    ],
  },
  {
    id: "participants",
    label: "For Participants",
    icon: UserRound,
    items: [
      { id: "participant-dashboard", label: "Your Dashboard" },
      { id: "submitting-a-request", label: "Requesting a Payment" },
      { id: "payment-breakdown", label: "Understanding Your Payment" },
      { id: "request-status", label: "Tracking Your Request" },
      { id: "event-check-in", label: "Checking In to an Event" },
      { id: "participant-analytics", label: "Your Payment History" },
      { id: "updating-profile", label: "Updating Your Profile" },
    ],
  },
  {
    id: "client-admin",
    label: "For Administrators",
    icon: Building2,
    items: [
      { id: "admin-dashboard-overview", label: "The Admin Dashboard" },
      { id: "managing-participants", label: "Managing Participants" },
      { id: "managing-venues", label: "Managing Venues" },
      { id: "managing-events", label: "Creating Events" },
      { id: "approving-requests", label: "Approving Requests" },
      { id: "paying-requests", label: "Paying Requests" },
      { id: "amending-requests", label: "Correcting a Payment" },
      { id: "checkin-reports", label: "Event Check-In Reports" },
      { id: "reports-filtering", label: "Reports & Filtering" },
      { id: "analytics-charts", label: "Analytics Charts" },
      { id: "historical-import", label: "Importing Past Records" },
      { id: "documents-onedrive", label: "Sending Documents" },
      { id: "inviting-admins", label: "Inviting Administrators" },
    ],
  },
  {
    id: "super-admin",
    label: "For Super Administrators",
    icon: ShieldCheck,
    items: [
      { id: "managing-clients", label: "Managing Organizations" },
      { id: "client-dashboard-button", label: "Viewing a Client's Dashboard" },
      { id: "deleting-clients", label: "Removing an Organization" },
      { id: "all-submissions", label: "All Submissions" },
      { id: "insights", label: "Insights" },
      { id: "participant-lookup", label: "Looking Up Anyone" },
    ],
  },
  {
    id: "master-admin",
    label: "For Master Administrators",
    icon: Crown,
    items: [
      { id: "master-admin-overview", label: "Overseeing the Platform" },
    ],
  },
  {
    id: "features",
    label: "Features & Tips",
    icon: Sparkles,
    items: [
      { id: "guide-me-tour", label: "The Guided Walkthrough" },
      { id: "downloads", label: "Downloading Reports & Charts" },
      { id: "quarter-filter", label: "Quarter Filters" },
      { id: "data-security", label: "Keeping Your Data Secure" },
    ],
  },
];

const ALL_IDS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)).concat(["faq"]);

/** Lightweight scroll-spy: highlights whichever section heading is
 * currently nearest the top of the viewport, without any heavier
 * dependency - just IntersectionObserver over each section's heading. */
function useActiveSection(): string {
  const [active, setActive] = useState<string>(ALL_IDS[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );
    for (const id of ALL_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return active;
}

export function DocumentationSidebar() {
  const active = useActiveSection();

  return (
    <SidebarMenu>
      {NAV_GROUPS.map((group) => (
        <SidebarMenuItem key={group.id}>
          <Accordion type="single" collapsible defaultValue={group.id}>
            <AccordionItem value={group.id} className="border-none">
              <AccordionTrigger className="flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline py-0 [&>svg:last-child]:h-4 [&>svg:last-child]:w-4">
                <span className="flex items-center gap-2">
                  <group.icon className="h-4 w-4 shrink-0" />
                  {group.label}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <SidebarMenuSub>
                  {group.items.map((item) => (
                    <SidebarMenuSubItem key={item.id}>
                      <SidebarMenuSubButton asChild isActive={active === item.id}>
                        <a href={`#${item.id}`}>{item.label}</a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SidebarMenuItem>
      ))}
      <SidebarMenuItem>
        <a
          href="#faq"
          className={cn(
            "flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            active === "faq" && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          )}
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          FAQ
        </a>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
