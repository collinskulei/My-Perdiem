import type { ComponentType, ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** A titled section with a stable anchor id - scroll-mt so the sticky
 * header never covers the heading when jumped to via the sidebar. */
export function DocSection({ id, title, icon: Icon, children }: {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 border-b pb-10 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

export function DocSubHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="scroll-mt-24 text-lg font-semibold text-foreground pt-2">
      {children}
    </h3>
  );
}

export function DocP({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

export function DocSteps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-5 text-muted-foreground marker:font-semibold marker:text-foreground">{children}</ol>;
}

export function DocList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">{children}</ul>;
}

/** A short, friendly aside - tips, reassurances, or "who can do this" notes. */
export function DocNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground", className)}>
      <Info className="h-4 w-4 shrink-0 translate-y-0.5 text-primary" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** A small colored badge naming which account type(s) a feature applies to. */
export function RoleTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {children}
    </span>
  );
}
