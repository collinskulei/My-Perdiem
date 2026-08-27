"use client";

/**
 * Thin animated progress bar pinned to the top of the viewport - the
 * "something is happening" signal for slow data fetches (see
 * MILESTONE_HANDOFF.md's fetchAllRows note) that don't have a real
 * percentage to report, so it's an indeterminate sweep rather than a bar
 * that fills to a known point.
 *
 * Deliberately `position: fixed` and rendered wherever a page's own
 * `loading` state is true, rather than living in a shared layout shell -
 * every admin/employee page already tracks its own `loading` boolean, and
 * a fixed-position element renders at the top of the viewport regardless
 * of where in the component tree it's mounted, so no context/prop-drilling
 * through the layout is needed to reach it.
 */
export function TopLoadingBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      className="fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-primary/10"
    >
      <div className="h-full w-1/3 animate-top-loading-sweep rounded-full bg-gradient-to-r from-transparent via-primary to-[#3b82f6] shadow-[0_0_10px_hsl(var(--primary)/0.8)]" />
    </div>
  );
}
