/**
 * @file Shared building blocks for the Super/Master Admin "Insights" tab
 * (see docs/MILESTONE_HANDOFF.md) - card styling, stat cards, chart-color
 * conventions, and PDF export. Kept dependency-free of admin-dashboard.tsx
 * (only imports from @/lib and @/components/ui) so there's no circular
 * import back into the file that mounts this tab.
 */
"use client";

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode, RefObject, CSSProperties } from "react";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import { Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/**
 * Single source of truth for status colors - previously duplicated
 * separately in admin-dashboard.tsx's AnalyticsTabContent and
 * employee-dashboard.tsx's ANALYTICS_COLORS. Both should import this.
 */
export const STATUS_COLORS: Record<string, string> = {
  Pending: "#f97316",
  Approved: "#10b981",
  Amended: "#64748b",
  Paid: "#3b82f6",
  Rejected: "#ef4444",
  Confirmed: "#22c55e",
};

// A fixed green/blue/gray palette for categorical breakdowns that don't
// already have a status-style color convention - deliberately NOT the
// design system's --chart-1..5 tokens, since --chart-4/--chart-5 resolve
// to purple/pink in dark mode. Fixed hex values (not theme-dependent) so
// the palette looks the same, and never purple, in either theme.
export const CHART_PALETTE = [
  "#3b82f6", // blue
  "#10b981", // green
  "#0ea5e9", // sky blue
  "#64748b", // slate gray
  "#059669", // deeper green
];

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

export const glassTooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
    color: "hsl(var(--card-foreground))",
  },
} as const;

/** Animated count-up for stat card numbers - plain requestAnimationFrame,
 * no new dependency. Re-animates whenever `target` changes. */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

export function InsightCard({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <Card
      className={cn(
        "bg-card/60 backdrop-blur-xl border-border/50 shadow-[0_0_40px_-15px_hsl(var(--primary)/0.15)] hover:shadow-[0_0_60px_-10px_hsl(var(--primary)/0.3)] hover:scale-[1.02] transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-4",
        className
      )}
      style={style}
    >
      {children}
    </Card>
  );
}

export function StatCard({ icon: Icon, label, value, formatter, delay = 0 }: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  formatter?: (v: number) => string;
  delay?: number;
}) {
  const animated = useCountUp(value);
  return (
    <InsightCard style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 shrink-0 text-primary" />
      </CardHeader>
      <CardContent>
        {/* whitespace-nowrap+truncate instead of wrapping - a wrapped value
        like "Ksh 44,41" / "5,600.00" splitting mid-number is worse than an
        ellipsis, and the caller sizes the grid (2/3/5-per-row) so there's
        enough room per card that truncation shouldn't normally trigger.
        Shrinks at xl specifically because that's the narrowest per-card
        width (5-per-row kicks in there) - widening again at 2xl once
        there's more room per card. */}
        <p className="text-2xl md:text-3xl xl:text-lg 2xl:text-2xl font-bold truncate tabular-nums bg-gradient-to-r from-primary to-[#3b82f6] bg-clip-text text-transparent" title={formatter ? formatter(animated) : Math.round(animated).toLocaleString()}>
          {formatter ? formatter(animated) : Math.round(animated).toLocaleString()}
        </p>
      </CardContent>
    </InsightCard>
  );
}

async function captureNodeAsJpeg(node: HTMLElement): Promise<string> {
  // Reads the actual rendered background instead of hardcoding 'white' (the
  // old AnalyticsTabContent's approach) - that hardcoding produces
  // illegible light-on-white exports when captured in dark mode.
  const backgroundColor = getComputedStyle(node).backgroundColor;
  return toJpeg(node, { cacheBust: true, backgroundColor, pixelRatio: 2 });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Fits a captured chart image onto one landscape PDF page, preserving
 * aspect ratio, with a title printed above it. */
function addImagePage(doc: jsPDF, dataUrl: string, title: string, imgWidth: number, imgHeight: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  doc.setFontSize(14);
  doc.text(title, margin, margin);
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2 - 10;
  const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
  doc.addImage(dataUrl, "JPEG", margin, margin + 10, imgWidth * ratio, imgHeight * ratio);
}

export async function downloadChartAsPdf(ref: RefObject<HTMLElement>, filename: string, title: string) {
  if (!ref.current) return;
  const dataUrl = await captureNodeAsJpeg(ref.current);
  const img = await loadImage(dataUrl);
  const doc = new jsPDF({ orientation: "landscape" });
  addImagePage(doc, dataUrl, title, img.width, img.height);
  doc.save(`${filename}.pdf`);
}

export async function downloadSectionAsPdf(charts: { ref: RefObject<HTMLElement>; title: string }[], filename: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  let renderedAny = false;
  for (const { ref, title } of charts) {
    if (!ref.current) continue;
    const dataUrl = await captureNodeAsJpeg(ref.current);
    const img = await loadImage(dataUrl);
    if (renderedAny) doc.addPage();
    renderedAny = true;
    addImagePage(doc, dataUrl, title, img.width, img.height);
  }
  if (renderedAny) doc.save(`${filename}.pdf`);
}

export function ChartCard({ title, chartRef, filename, children, extra }: {
  title: string;
  chartRef: RefObject<HTMLDivElement>;
  filename: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
  const { toast } = useToast();
  const handleDownload = async () => {
    try {
      await downloadChartAsPdf(chartRef, filename, title);
    } catch (err) {
      console.error("Failed to download chart PDF", err);
      toast({ title: "Download Failed", description: "Could not generate a PDF for this chart.", variant: "destructive" });
    }
  };
  return (
    <InsightCard>
      <div ref={chartRef}>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {extra}
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">{children}</CardContent>
      </div>
    </InsightCard>
  );
}

export function SectionHeader({ icon: Icon, title, description, onDownloadSection }: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onDownloadSection: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-[#3b82f6] bg-clip-text text-transparent">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="h-0.5 w-24 bg-gradient-to-r from-primary to-transparent rounded-full" />
      </div>
      <Button variant="outline" size="sm" onClick={onDownloadSection}>
        <FileDown className="mr-2 h-4 w-4" />
        Download Section (PDF)
      </Button>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-center p-10 text-muted-foreground">{message}</div>;
}

export function InsightsLoadingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}
