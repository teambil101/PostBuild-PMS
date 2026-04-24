import { cn } from "@/lib/utils";
import { type PeriodKey, PERIOD_LABELS } from "@/lib/performance";

interface PeriodSelectorProps {
  value: PeriodKey;
  onChange: (v: PeriodKey) => void;
}

const ORDER: PeriodKey[] = ["30d", "90d", "ytd", "all"];
const SHORT: Record<PeriodKey, string> = {
  "30d": "30d",
  "90d": "90d",
  ytd: "YTD",
  all: "All",
};

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div
      className="inline-flex items-center rounded-sm border hairline bg-muted/30 p-0.5"
      role="tablist"
      aria-label="Period"
    >
      {ORDER.map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          title={PERIOD_LABELS[k]}
          className={cn(
            "px-3 py-1.5 text-[11px] uppercase tracking-wider rounded-sm transition-colors",
            value === k
              ? "bg-architect text-chalk"
              : "text-muted-foreground hover:text-architect",
          )}
        >
          {SHORT[k]}
        </button>
      ))}
    </div>
  );
}
