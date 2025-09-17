/**
 * @file This file contains the client-side layout structure for the employee dashboard.
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
import { LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { EmployeeHeader } from './employee-header';
import { EmployeeSidebarNavigation } from './employee-sidebar-navigation';

/**
 * The client-side wrapper for the employee layout, containing all interactive UI.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The server-rendered page content.
 * @returns {JSX.Element} The rendered client-side layout.
 */
export function EmployeeLayoutClient({ children }: { children: React.ReactNode }) {
  return (
     <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo />
          </div>
        </SidebarHeader>
        <SidebarContent>
            <EmployeeSidebarNavigation />
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
        <EmployeeHeader />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
