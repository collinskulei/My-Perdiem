
/**
 * @file AdminLayout provides a consistent sidebar and header for all pages within the admin section.
 * It includes navigation links for the admin dashboard, employees, and reports.
 */
import type { Metadata } from 'next';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import {
  Bell,
  Home,
  LogOut,
  User,
  ClipboardList,
  CalendarDays,
  ClipboardCheck,
  Users,
  MapPin,
  FileText,
  BarChart,
} from "lucide-react";
import { AdminHeader } from './admin-header';
import { AdminSidebarNavigation } from './admin-sidebar-navigation';

export const metadata: Metadata = {
  title: 'Admin Dashboard | PerdiemPro',
  description: 'Manage per diem requests, events, and employees.',
};


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
