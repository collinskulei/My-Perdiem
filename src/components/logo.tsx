import { PocketKnife } from "lucide-react";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <PocketKnife className="h-7 w-7 text-primary" />
      <h1 className="text-2xl font-bold text-primary">PerdiemPro</h1>
    </div>
  );
}
