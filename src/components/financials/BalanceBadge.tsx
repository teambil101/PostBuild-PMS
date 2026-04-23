import { cn } from "@/lib/utils";
import { balanceTone, daysPastDue, type BadgeTone } from "@/lib/financialFormulas";

interface BalanceBadgeProps {
  balance: number;
  currency?: string;
  /** ISO date string of the earliest unpaid item; drives the color. */
  earliestDueDate?: string | null;
  /** Optional label override (defaults to formatted balance). */
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
  neutral: "bg-muted/60 text-foreground border-border",
  warning: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  danger: "bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900",
};

export function BalanceBadge({
  balance,
  currency = "AED",
  earliestDueDate,
  label,
  className,
  size = "md",
}: BalanceBadgeProps) {
  const dpd = earliestDueDate ? daysPastDue(earliestDueDate) : -999;
  const tone = balanceTone(dpd, balance > 0);

  const formatted =
    label ??
    `${currency} ${balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-medium tabular-nums",
        TONE_CLASSES[tone],
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className,
      )}
    >
      {formatted}
      {balance > 0 && dpd > 0 && (
        <span className="opacity-70">· {dpd}d overdue</span>
      )}
    </span>
  );
}