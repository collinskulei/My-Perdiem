/**
 * @file Simple Light/Dark switch for Settings > Preferences, backed by
 * next-themes (class-based, matching tailwind.config.ts's darkMode: ['class']
 * and the .dark palette already defined in globals.css).
 */
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [hasMounted, setHasMounted] = useState(false);

  // Avoid a hydration mismatch: the server has no theme cookie/localStorage
  // to read, so resolvedTheme is only trustworthy after mount.
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const isDark = hasMounted && resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      disabled={!hasMounted}
      className="w-full sm:w-auto"
    >
      {isDark ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
      {isDark ? "Dark" : "Light"} mode
    </Button>
  );
}
