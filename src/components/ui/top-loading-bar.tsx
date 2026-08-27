"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Trickle" progress bar pinned to the top of the viewport, plus a small
 * status pill - the same pattern GitHub/YouTube/Vercel use for a fetch with
 * no real percentage to report: jump forward immediately, keep advancing
 * but slow down as it nears a ceiling it never reaches on its own, then
 * snap to 100% and hold briefly once the real work finishes. Reads as
 * active progress rather than an indeterminate sweep, without needing to
 * plumb real byte/row counts up from every fetch that uses it.
 *
 * Deliberately `position: fixed` and rendered wherever a page's own
 * `loading` state is true, rather than living in a shared layout shell -
 * every admin/employee page already tracks its own `loading` boolean, and
 * a fixed-position element renders at the top of the viewport regardless
 * of where in the component tree it's mounted, so no context/prop-drilling
 * through the layout is needed to reach it.
 */
export function TopLoadingBar({ active, label = "Syncing data…" }: { active: boolean; label?: string }) {
  const [visible, setVisible] = useState(active);
  const [progress, setProgress] = useState(0);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active) {
      wasActive.current = true;
      setVisible(true);
      setProgress(14);
      const interval = setInterval(() => {
        // Slows as it approaches 90% (never gets there on its own) - a
        // constant-speed bar either finishes "for real" way too early
        // (looks fake) or crawls the whole time (looks stuck).
        setProgress((p) => (p >= 90 ? p : p + (90 - p) * 0.09 + 0.5));
      }, 200);
      return () => clearInterval(interval);
    }

    if (wasActive.current) {
      setProgress(100);
      const timeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
        wasActive.current = false;
      }, 350);
      return () => clearTimeout(timeout);
    }
  }, [active]);

  if (!visible) return null;

  return (
    <>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(progress)}
        className="fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-primary/10"
      >
        <div
          className="h-full bg-gradient-to-r from-primary to-[#3b82f6] shadow-[0_0_10px_hsl(var(--primary)/0.8)] transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="fixed top-3 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/50 bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-xl animate-in fade-in-0 slide-in-from-top-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        {label}
      </div>
    </>
  );
}
