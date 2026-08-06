/**
 * @file This file defines the Logo component for the application.
 * It displays the application's icon and name.
 */
"use client";

import { cn } from "@/lib/utils";


/**
 * A reusable component that displays the application logo.
 * @param {object} props - The properties for the component.
 * @param {string} [props.className] - Optional additional CSS classes to apply to the logo container.
 * @returns {JSX.Element} The rendered logo component.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <h1 className="text-2xl font-bold text-primary-foreground">My Perdiem</h1>
    </div>
  );
}
