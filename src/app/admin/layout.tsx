/**
 * @file AdminLayout provides a consistent sidebar and header for all pages within the admin section.
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
import { Logo } from "@/components/logo";
import { LogOut } from "lucide-react";
import { AdminHeader } from './admin-header';
import { AdminSidebarNavigation } from './admin-sidebar-navigation';

// Client-side wrapper for the layout
function AdminLayoutClient({ children }: { children: React.ReactNode }) {
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


/**
 * Defines the layout for the admin section, including a sidebar and main content area.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The child components to be rendered within the main content area.
 * @returns {JSX.Element} The admin layout component.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
