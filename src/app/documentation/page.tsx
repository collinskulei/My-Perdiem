/**
 * @file A single, comprehensive, non-technical documentation page covering
 * every feature of the app for every account type - Participant, Client
 * Admin, Super Admin, and Master Admin. Deliberately public (no auth guard)
 * so it's useful even to someone who hasn't signed in yet. One long page
 * with anchor-linked sections (not separate routes), per the request for
 * "a page" at /documentation specifically, navigated via the sidebar's
 * grouped links (see documentation-sidebar.tsx) and a lightweight
 * scroll-spy for "you are here" highlighting.
 */
import Link from "next/link";
import { LogIn } from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { DocumentationSidebar } from "./documentation-sidebar";
import { GettingStartedSections } from "./sections-getting-started";
import { ParticipantSections } from "./sections-participants";
import { ClientAdminSections } from "./sections-client-admin";
import { SuperAdminSections } from "./sections-super-admin";
import { MasterAdminSections } from "./sections-master-admin";
import { FeaturesSections, FaqSection } from "./sections-features-faq";

export const metadata = {
  title: "Documentation - My Perdiem",
  description: "A plain-language guide to everything My Perdiem can do.",
};

export default function DocumentationPage() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
          <p className="px-2 text-xs text-sidebar-foreground/70">User Guide</p>
        </SidebarHeader>
        <SidebarContent>
          <DocumentationSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <span className="font-semibold">Documentation</span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Link>
          </Button>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 p-4 sm:p-8">
          <div className="space-y-2 pb-2">
            <h1 className="text-3xl font-bold tracking-tight">My Perdiem User Guide</h1>
            <p className="text-muted-foreground">
              A plain-language guide to everything the app can do - no
              technical knowledge needed. Use the sidebar to jump to any
              topic.
            </p>
          </div>
          <GettingStartedSections />
          <ParticipantSections />
          <ClientAdminSections />
          <SuperAdminSections />
          <MasterAdminSections />
          <FeaturesSections />
          <FaqSection />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
