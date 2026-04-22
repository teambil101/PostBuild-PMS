import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  count: number;
  defaultOpen?: boolean;
  refSet?: (el: HTMLDivElement | null) => void;
  highlight?: boolean;
  toneClass?: string; // border accent for the count chip
  emptyMessage: string;
  headerActions?: ReactNode;
  children?: ReactNode;
}

export function StageSection({
  title, subtitle, count, defaultOpen = true, refSet, highlight,
  toneClass, emptyMessage, headerActions, children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      ref={refSet}
      className={cn(
        "border hairline rounded-sm bg-card overflow-hidden transition-shadow",
        highlight && "ring-2 ring-gold shadow-md",
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 text-left flex-1 min-w-0"
        >
          {open ? <ChevronDown className="h-4 w-4 text-true-taupe shrink-0" /> : <ChevronRight className="h-4 w-4 text-true-taupe shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="label-eyebrow text-architect">{title}</span>
              <span
                className={cn(
                  "mono text-[11px] px-2 py-0.5 rounded-sm border bg-background",
                  toneClass ?? "border-warm-stone text-architect",
                )}
              >
                {count}
              </span>
            </div>
            {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
          </div>
        </button>
        {headerActions && <div className="shrink-0 flex items-center gap-2">{headerActions}</div>}
      </div>
      {open && (
        <div className="border-t hairline">
          {count === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground italic text-center">
              {emptyMessage}
            </div>
          ) : children}
        </div>
      )}
    </div>
  );
}
