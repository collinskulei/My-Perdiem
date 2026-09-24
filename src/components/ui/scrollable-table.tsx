"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A <table> inside a single internal scroll container, so extra-wide
 * columns scroll horizontally *within* the table's own box instead of
 * pushing the whole page sideways.
 *
 * - One scroll container, no nested tables and no second wrapper -
 *   callers should NOT wrap this in their own `overflow-x-auto` div.
 * - Cells don't wrap (`white-space: nowrap` on the <table>, inherited by
 *   every cell), so columns keep their natural width rather than
 *   compressing into tall, unreadable stacks. Because it's inherited
 *   rather than forced per cell, a cell that genuinely needs to wrap (a
 *   long note) can still opt out with `whitespace-normal`, and
 *   `max-w-* truncate` cells keep working. Cells with a `colSpan`
 *   (empty-state / message rows) wrap by default.
 * - `contain: inline-size` on the outer box means the table's content
 *   width never feeds back into its parent's width - this is what stops a
 *   wide table inside a flex/grid layout (e.g. SidebarInset, CardContent
 *   in a grid) from widening the page, even where an ancestor is missing
 *   `min-w-0`.
 * - Momentum scrolling on iOS (`-webkit-overflow-scrolling: touch`), and
 *   `overscroll-behavior-x: contain` so a horizontal swipe that reaches
 *   the table's edge doesn't trigger the browser's back/forward gesture
 *   and navigate away mid-task.
 * - Soft edge shadows appear only on the side(s) with more content to
 *   scroll to, so a hidden column is never mistaken for missing data.
 * - When it actually overflows, the scroll area becomes keyboard
 *   focusable (arrow keys scroll it) and is labelled as a region for
 *   screen readers - WCAG 2.1.1 for scrollable content.
 */
export interface ScrollableTableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Classes for the scroll container, e.g. `max-h-80 border rounded-md` for a vertically-capped table. */
  containerClassName?: string
  /** Pins the header row while the body scrolls vertically - only useful with a max-height on the container. */
  stickyHeader?: boolean
  /** Accessible name for the scroll region (announced when a keyboard user tabs into it). */
  "aria-label"?: string
}

const ScrollableTable = React.forwardRef<HTMLTableElement, ScrollableTableProps>(
  ({ className, containerClassName, stickyHeader = false, "aria-label": ariaLabel, ...props }, ref) => {
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const [edges, setEdges] = React.useState({ left: false, right: false, overflowing: false })

    React.useEffect(() => {
      const el = scrollRef.current
      if (!el) return

      let frame = 0
      const measure = () => {
        frame = 0
        const maxScroll = el.scrollWidth - el.clientWidth
        // 1px tolerance - fractional widths at non-100% zoom otherwise
        // leave a permanent sliver of "more content" shadow.
        const next = {
          overflowing: maxScroll > 1,
          left: el.scrollLeft > 1,
          right: el.scrollLeft < maxScroll - 1,
        }
        setEdges(prev =>
          prev.left === next.left && prev.right === next.right && prev.overflowing === next.overflowing ? prev : next
        )
      }
      // Coalesce scroll/resize bursts into one measurement per frame.
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(measure)
      }

      measure()
      el.addEventListener("scroll", schedule, { passive: true })
      // Container resizes (window, sidebar toggle) and content changes
      // (rows loading in, pagination) both change whether it overflows.
      const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null
      observer?.observe(el)
      if (el.firstElementChild) observer?.observe(el.firstElementChild)

      return () => {
        el.removeEventListener("scroll", schedule)
        observer?.disconnect()
        if (frame) cancelAnimationFrame(frame)
      }
    }, [])

    return (
      <div className="relative w-full min-w-0 max-w-full [contain:inline-size]">
        <div
          ref={scrollRef}
          role={edges.overflowing ? "region" : undefined}
          aria-label={edges.overflowing ? ariaLabel ?? "Scrollable table" : undefined}
          tabIndex={edges.overflowing ? 0 : undefined}
          className={cn(
            "relative w-full overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] motion-safe:scroll-smooth",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            containerClassName
          )}
        >
          <table
            ref={ref}
            className={cn(
              "w-full caption-bottom text-sm whitespace-nowrap",
              // Full-width message rows ("No requests match the current
              // filters.") span every column and are prose, not data - they
              // wrap, so an empty state never forces a sideways scroll.
              "[&_td[colspan]]:whitespace-normal",
              stickyHeader && "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-card",
              className
            )}
            {...props}
          />
        </div>
        {/* Edge shadows sit on the non-scrolling outer box so they stay put
        while the table moves underneath; pointer-events-none keeps them
        from ever blocking a click on the cell beneath. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-foreground/10 to-transparent transition-opacity duration-200",
            edges.left ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-foreground/10 to-transparent transition-opacity duration-200",
            edges.right ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    )
  }
)
ScrollableTable.displayName = "ScrollableTable"

export { ScrollableTable }
