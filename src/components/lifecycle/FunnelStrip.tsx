import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LIFECYCLE_STAGE_ORDER,
  LIFECYCLE_STAGE_SHORT,
  LIFECYCLE_STAGE_LABELS,
  type LifecycleStage,
} from "@/lib/lifecycle";

interface Props {
  counts: Record<LifecycleStage, number>;
  deltas: Record<LifecycleStage, number>;
  active: LifecycleStage | null;
  onSelect: (stage: LifecycleStage) => void;
}

const STAGE_TONE: Record<LifecycleStage, string> = {
  not_ready: "border-status-maintenance/40",
  ready_unlisted: "border-warm-stone",
  listed: "border-status-vacant/40",
  offer_pending: "border-amber-500/40",
  in_signing: "border-amber-600/50",
  leased: "border-status-occupied/40",
};

export function FunnelStrip({ counts, deltas, active, onSelect }: Props) {
  return (
    <div className="border hairline rounded-sm bg-card p-4 mb-6">
      <div className="label-eyebrow text-architect mb-3">Leasing funnel</div>
      <div className="flex items-stretch gap-2 overflow-x-auto">
        {LIFECYCLE_STAGE_ORDER.map((stage, idx) => {
          const isLast = idx === LIFECYCLE_STAGE_ORDER.length - 1;
          const isActive = active === stage;
          const count = counts[stage] ?? 0;
          const delta = deltas[stage] ?? 0;

          // Conversion to next stage
          let conv: number | null = null;
          if (!isLast) {
            const next = counts[LIFECYCLE_STAGE_ORDER[idx + 1]] ?? 0;
            const total = count + next;
            conv = total > 0 ? Math.round((next / total) * 100) : null;
          }

          return (
            <div key={stage} className="flex items-stretch gap-2 flex-1 min-w-[140px]">
              <button
                onClick={() => onSelect(stage)}
                className={cn(
                  "flex-1 flex flex-col items-start gap-1 px-3 py-3 border-2 rounded-sm bg-background text-left transition-all hover:shadow-sm hover:-translate-y-px",
                  STAGE_TONE[stage],
                  isActive && "ring-2 ring-gold ring-offset-1",
                )}
                title={LIFECYCLE_STAGE_LABELS[stage]}
              >
                <div className="flex items-baseline justify-between w-full gap-2">
                  <span className="font-display text-3xl text-architect leading-none">{count}</span>
                  {delta > 0 && (
                    <span className="mono text-[10px] text-status-occupied">+{delta} 30d</span>
                  )}
                </div>
                <div className="label-eyebrow text-[10px] text-architect">{LIFECYCLE_STAGE_SHORT[stage]}</div>
                <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                  {LIFECYCLE_STAGE_LABELS[stage]}
                </div>
              </button>
              {!isLast && (
                <div className="flex flex-col items-center justify-center px-1 shrink-0">
                  <ChevronRight className="h-4 w-4 text-true-taupe" />
                  {conv != null && (
                    <span className="mono text-[9px] text-muted-foreground mt-0.5">{conv}%</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
