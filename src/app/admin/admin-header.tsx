
'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ClientOnly } from "@/components/client-only";
import { signOutEverywhere } from "@/lib/supabase/auth";
import { useTour } from "@/components/tour/tour-provider";

export function AdminHeader({
  loginPath = "/",
  portalLabel,
}: {
  loginPath?: string;
  portalLabel?: string;
}) {
  const router = useRouter();
  const { startTour } = useTour();
  const handleLogout = async () => {
    await signOutEverywhere();
    router.push(loginPath);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 lg:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="flex flex-1 items-center justify-end gap-4">
        {portalLabel && (
          <span className="hidden sm:inline text-sm text-muted-foreground">{portalLabel}</span>
        )}
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Toggle notifications</span>
        </Button>
        <ClientOnly>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-tour="account-menu">
                  <Avatar className="h-8 w-8">
                  <AvatarImage src="https://picsum.photos/seed/admin/100/100" data-ai-hint="person avatar" />
                  <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/profile">Profile</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/settings">Settings</Link></DropdownMenuItem>
              <DropdownMenuItem onClick={startTour}>
                <Compass className="mr-2 h-4 w-4" />
                Guide me
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ClientOnly>
      </div>
    </header>
  );
}
