/**
 * @file Settings > Preferences. Standalone page (same centered-Card pattern
 * as /profile), reachable from every portal's account-menu "Settings" item.
 * A personal preference page, not tier-specific, so it isn't nested under
 * any dashboard shell.
 */
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SettingsPage() {
  return (
    <div className="flex justify-center items-start p-4 sm:p-6">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Personal display preferences for your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-medium">Appearance</p>
                <p className="text-sm text-muted-foreground">Switch between light and dark mode.</p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
