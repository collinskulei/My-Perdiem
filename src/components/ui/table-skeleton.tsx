import { TableCell, TableRow } from "@/components/ui/table";

/**
 * Drop-in replacement for a plain "Loading X..." text row - shimmering
 * placeholder bars (see .skeleton-shimmer in globals.css) across the same
 * column count, so a slow table fetch reads as active progress instead of
 * a static line of text. Bar widths vary per cell (a simple hash of row +
 * column index) so the skeleton doesn't look like a rigid grid.
 */
export function TableSkeletonRows({ rows = 5, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c}>
              <div
                className="h-4 rounded skeleton-shimmer"
                style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
