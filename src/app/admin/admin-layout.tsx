/**
 * @file This file contains the client-side layout structure for the admin dashboard.
 */
"use client";

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { LogOut } from "lucide-react";
import { AdminHeader } from './admin-header';
import { AdminSidebarNavigation } from './admin-sidebar-navigation';
import { AdminTabProvider } from './admin-tab-context';
import { ModuleSwitcher, type ActiveModule } from './module-switcher';
import { PortalProvider } from './portal-context';
import type { PortalInfo } from './portal-access';
import { SalarySidebarNavigation } from './salary/salary-sidebar-navigation';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutEverywhere } from "@/lib/supabase/auth";

/**
 * The client-side wrapper for the admin layout, containing all interactive UI.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The server-rendered page content.
 * @param {PortalInfo | null} props.portal - Portal/client/modules resolved
 * server-side (portal-access.ts); when set, the sidebar starts with the
 * module switcher. Omitted by the legacy generic /admin portal.
 * @param {ActiveModule} props.activeModule - Which module's tabs the
 * sidebar shows under the switcher ('home' shows none).
 * @returns {JSX.Element} The rendered client-side layout.
 */
export function AdminLayoutClient({
  children,
  basePath = "/admin",
  loginPath = "/",
  portalLabel,
  portal = null,
  activeModule = "perdiem",
}: {
  children: React.ReactNode;
  basePath?: string;
  loginPath?: string;
  portalLabel?: string;
  portal?: PortalInfo | null;
  activeModule?: ActiveModule;
}) {
  const router = useRouter();
  const handleLogout = async () => {
    await signOutEverywhere();
    router.push(loginPath);
  };

  return (
    <PortalProvider portal={portal}>
    <AdminTabProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2">
              <Logo />
            </div>
          </SidebarHeader>
          <SidebarContent>
            {portal ? (
              <>
                <ModuleSwitcher portal={portal} active={activeModule} />
                {activeModule === "perdiem" && (
                  <SidebarGroup>
                    <AdminSidebarNavigation basePath={basePath} />
                  </SidebarGroup>
                )}
                {activeModule === "salary" && (
                  <SidebarGroup>
                    <SalarySidebarNavigation basePath={basePath} />
                  </SidebarGroup>
                )}
              </>
            ) : (
              <AdminSidebarNavigation basePath={basePath} />
            )}
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut />
                  Logout
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
             <div className="text-center text-xs text-sidebar-foreground/60 p-2 mt-2">
              <p>Myperdiem provided by <Link href="https://www.tuque.africa" target="_blank" rel="noopener noreferrer" className="underline hover:text-sidebar-foreground">Tuque Consulting</Link></p>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <AdminHeader loginPath={loginPath} portalLabel={portalLabel} />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AdminTabProvider>
    </PortalProvider>
  );
}
