import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttentionTopItem } from "@/lib/dashboard";

interface AttentionCardProps {
  title: string;
  primary: string | number;
  secondary?: string;
  topItems?: AttentionTopItem[];
  viewAllTo?: string;
  /** Override tone (default: 'alert' if primary > 0, otherwise 'ok'). */
  tone?: "ok" | "warn" | "alert" | "neutral";
  /** Render any custom body (used for grouped cards like Compliance / Data Gaps). */
  customBody?: React.ReactNode;
}

export function AttentionCard({
  title,
  primary,
  secondary,
  topItems,
  viewAllTo,
  tone,
  customBody,
}: AttentionCardProps) {
  const numericPrimary = typeof primary === "number" ? primary : Number(primary);
  const resolvedTone = tone ?? (Number.isFinite(numericPrimary) && numericPrimary > 0 ? "alert" : "ok");
  const primaryClass = {
    ok: "text-emerald-700",
    warn: "text-amber-700",
    alert: "text-destructive",
    neutral: "text-architect",
  }[resolvedTone];

  return (
    <div className="bg-card border hairline rounded-sm p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base text-architect leading-tight">{title}</h3>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="mono text-[10px] uppercase tracking-wider text-gold-deep hover:text-architect inline-flex items-center gap-1 shrink-0"
          >
            View <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className={cn("font-display text-3xl mt-2 leading-none", primaryClass)}>{primary}</div>
      {secondary && <div className="text-xs text-muted-foreground mt-1">{secondary}</div>}

      {customBody}

      {topItems && topItems.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t hairline pt-3">
          {topItems.slice(0, 5).map((item) => {
            const inner = (
              <>
                <span className="text-sm text-architect truncate">{item.label}</span>
                {item.secondary && (
                  <span className="text-xs text-muted-foreground truncate ml-2 shrink-0">
                    {item.secondary}
                  </span>
                )}
              </>
            );
            return (
              <li key={item.id} className="flex items-center justify-between gap-2 min-w-0">
                {item.href ? (
                  <Link
                    to={item.href}
                    className="flex items-center justify-between gap-2 min-w-0 w-full hover:bg-muted/40 px-1.5 -mx-1.5 py-0.5 rounded-sm transition-colors"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-2 min-w-0 w-full px-1.5 -mx-1.5 py-0.5">
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}