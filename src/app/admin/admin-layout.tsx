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
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { LogOut } from "lucide-react";
import { AdminHeader } from './admin-header';
import { AdminSidebarNavigation } from './admin-sidebar-navigation';

/**
 * The client-side wrapper for the admin layout, containing all interactive UI.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The server-rendered page content.
 * @returns {JSX.Element} The rendered client-side layout.
 */
export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <AdminSidebarNavigation />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="/">
                <LogOut />
                Logout
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <AdminHeader />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}