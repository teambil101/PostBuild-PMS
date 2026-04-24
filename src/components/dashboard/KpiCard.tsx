import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  deltaPct?: number | null;
  /** When true, a positive delta is bad (e.g. cost going up). */
  invertDelta?: boolean;
  tone?: "default" | "danger" | "warning";
}

export function KpiCard({ label, value, hint, deltaPct, invertDelta, tone = "default" }: KpiCardProps) {
  const showDelta = deltaPct != null && Number.isFinite(deltaPct);
  let deltaTone: "good" | "bad" | "flat" = "flat";
  if (showDelta) {
    const isUp = (deltaPct as number) > 0.0001;
    const isDown = (deltaPct as number) < -0.0001;
    if (isUp) deltaTone = invertDelta ? "bad" : "good";
    else if (isDown) deltaTone = invertDelta ? "good" : "bad";
  }
  return (
    <div
      className={cn(
        "border hairline rounded-sm bg-card p-4",
        tone === "danger" && "border-destructive/40",
        tone === "warning" && "border-amber-500/40",
      )}
    >
      <div className="label-eyebrow text-true-taupe">{label}</div>
      <div
        className={cn(
          "font-display text-2xl md:text-3xl text-architect mt-1.5 leading-tight",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        {showDelta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 mono",
              deltaTone === "good" && "text-status-occupied",
              deltaTone === "bad" && "text-destructive",
              deltaTone === "flat" && "text-muted-foreground",
            )}
          >
            {deltaTone === "good" && <ArrowUpRight className="h-3 w-3" strokeWidth={2} />}
            {deltaTone === "bad" && <ArrowDownRight className="h-3 w-3" strokeWidth={2} />}
            {deltaTone === "flat" && <Minus className="h-3 w-3" strokeWidth={2} />}
            {`${(deltaPct as number) > 0 ? "+" : ""}${((deltaPct as number) * 100).toFixed(1)}%`}
          </span>
        ) : (
          <span className="text-muted-foreground/60 mono">—</span>
        )}
        {hint && <span className="text-muted-foreground truncate">{hint}</span>}
      </div>
    </div>
  );
}
