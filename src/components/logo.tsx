/**
 * @file This file defines the Logo component for the application.
 * It displays the application's icon and name.
 */
"use client";

import Image from "next/image";

/**
 * A reusable component that displays the application logo.
 * @param {object} props - The properties for the component.
 * @param {string} [props.className] - Optional additional CSS classes to apply to the logo container.
 * @returns {JSX.Element} The rendered logo component.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image src="/logo.png" alt="My Perdiem Logo" width={32} height={32} />
      <h1 className="text-2xl font-bold text-primary">My Perdiem</h1>
    </div>
  );
}
