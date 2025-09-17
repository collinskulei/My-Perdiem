/**
 * @file DashboardLayout provides a consistent sidebar and header for all pages within the employee dashboard.
 */
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


function EmployeeLayoutClient({ children }: { children: React.ReactNode }) {
  'use client';
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


/**
 * Defines the layout for the employee dashboard, including a sidebar and main content area.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The child components to be rendered within the main content area.
 * @returns {JSX.Element} The dashboard layout component.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmployeeLayoutClient>{children}</EmployeeLayoutClient>;
}
