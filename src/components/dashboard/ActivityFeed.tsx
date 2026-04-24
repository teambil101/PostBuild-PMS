import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Activity, MessageSquare, CreditCard, Wrench } from "lucide-react";
import type { ActivityItem } from "@/lib/performance";
import { cn } from "@/lib/utils";

const ICONS = {
  service_event: Wrench,
  payment: CreditCard,
  feedback: MessageSquare,
} as const;

interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
}

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  return (
    <div className="border hairline rounded-sm bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-true-taupe" strokeWidth={1.5} />
        <div className="font-display text-base text-architect">Recent activity</div>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-muted/40 animate-pulse rounded-sm" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground italic">
          No activity in the last 30 days.
        </div>
      ) : (
        <ul className="divide-y divide-warm-stone/30">
          {items.map((it) => {
            const Icon = ICONS[it.kind];
            const Body = (
              <div className="flex items-start gap-3 py-2 group">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 mt-1 shrink-0",
                    it.kind === "feedback" && "text-gold",
                    it.kind === "payment" && "text-status-occupied",
                    it.kind === "service_event" && "text-true-taupe",
                  )}
                  strokeWidth={1.5}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-architect truncate">{it.title}</div>
                  {it.detail && (
                    <div className="text-[11px] text-muted-foreground truncate">{it.detail}</div>
                  )}
                </div>
                <span className="mono text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(it.at), { addSuffix: false })}
                </span>
              </div>
            );
            return (
              <li key={it.id}>
                {it.href ? (
                  <Link to={it.href} className="block hover:bg-muted/30 -mx-1 px-1 rounded-sm transition-colors">
                    {Body}
                  </Link>
                ) : (
                  Body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
