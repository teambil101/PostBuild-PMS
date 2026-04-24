import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface LeaderRow {
  id: string;
  name: string;
  href?: string | null;
  /** Primary metric — already formatted for display. */
  primary: string;
  /** Secondary metric — e.g. job count */
  secondary?: string;
  /** Subtle danger highlight for "bad" rows */
  warn?: boolean;
}

interface LeaderboardProps {
  title: string;
  description?: string;
  rows: LeaderRow[];
  emptyHint?: string;
  /** Note shown when nothing meets the min-sample threshold */
  thresholdNote?: string;
}

export function Leaderboard({ title, description, rows, emptyHint, thresholdNote }: LeaderboardProps) {
  return (
    <div className="border hairline rounded-sm bg-card p-4">
      <div className="mb-3">
        <div className="font-display text-base text-architect">{title}</div>
        {description && (
          <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground italic">
          {emptyHint ?? "No data for this period."}
          {thresholdNote && <div className="mt-1">{thresholdNote}</div>}
        </div>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((row, idx) => {
            const NameEl = row.href ? (
              <Link to={row.href} className="text-architect hover:underline truncate">
                {row.name}
              </Link>
            ) : (
              <span className="text-architect truncate">{row.name}</span>
            );
            return (
              <li
                key={row.id}
                className={cn(
                  "flex items-center gap-3 text-sm py-1.5 border-b hairline last:border-b-0",
                  row.warn && "bg-destructive/5 -mx-1.5 px-1.5 rounded-sm",
                )}
              >
                <span className="mono text-[10px] text-muted-foreground w-5 shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">{NameEl}</div>
                <span className="mono text-xs text-architect tabular-nums shrink-0">
                  {row.primary}
                </span>
                {row.secondary && (
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-14 text-right">
                    {row.secondary}
                  </span>
                )}
              </li>
            );
          })}
          {thresholdNote && (
            <li className="text-[10px] text-muted-foreground italic pt-2">{thresholdNote}</li>
          )}
        </ol>
      )}
    </div>
  );
}
