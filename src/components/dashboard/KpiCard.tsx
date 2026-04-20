import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Small line below the value. Emit a node so callers can color words. */
  subtitle?: ReactNode;
  delta?: number | null;
  /** Format the delta number — defaults to integer with sign. */
  formatDelta?: (n: number) => string;
  to?: string;
  /** Tone applied to the entire value (e.g. attention score). */
  tone?: "default" | "warn" | "alert" | "ok";
}

/**
 * Square-ish KPI card for the dashboard. Larger than module-page KPIs since
 * /dashboard is the primary surface.
 */
export function KpiCard({
  label,
  value,
  subtitle,
  delta,
  formatDelta,
  to,
  tone = "default",
}: KpiCardProps) {
  const valueTone = {
    default: "text-architect",
    warn: "text-amber-700",
    alert: "text-destructive",
    ok: "text-emerald-700",
  }[tone];

  const body = (
    <>
      <div className="label-eyebrow">{label}</div>
      <div
        className={cn(
          "font-display text-3xl xl:text-4xl mt-3 leading-none truncate",
          valueTone,
        )}
        title={typeof value === "string" || typeof value === "number" ? String(value) : undefined}
      >
        {value}
      </div>
      {(subtitle || delta !== undefined) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground min-h-[1rem]">
          {delta !== undefined && delta !== null && (
            <DeltaIndicator delta={delta} formatDelta={formatDelta} />
          )}
          {subtitle && <div className="leading-tight">{subtitle}</div>}
        </div>
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block bg-card border hairline rounded-sm p-5 hover:bg-muted/30 transition-colors"
      >
        {body}
      </Link>
    );
  }
  return <div className="bg-card border hairline rounded-sm p-5">{body}</div>;
}

function DeltaIndicator({
  delta,
  formatDelta,
}: {
  delta: number;
  formatDelta?: (n: number) => string;
}) {
  const fmt = formatDelta ?? ((n: number) => (n > 0 ? `+${n}` : `${n}`));
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="h-3 w-3" />
        {fmt(0)}
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-700">
        <ArrowUpRight className="h-3 w-3" />
        {fmt(delta)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-destructive">
      <ArrowDownRight className="h-3 w-3" />
      {fmt(delta)}
    </span>
  );
}