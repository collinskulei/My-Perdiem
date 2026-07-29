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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutEverywhere } from "@/lib/supabase/auth";

/**
 * The client-side wrapper for the admin layout, containing all interactive UI.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The server-rendered page content.
 * @returns {JSX.Element} The rendered client-side layout.
 */
export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const handleLogout = async () => {
    await signOutEverywhere();
    router.push("/");
  };

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
        <AdminHeader />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
