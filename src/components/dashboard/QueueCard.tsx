import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface QueueCardProps {
  title: string;
  count: number;
  viewAllTo?: string;
  emptyMessage: string;
  children: ReactNode;
}

/**
 * Wrapper for a Priority Queue on the My Work tab.
 * Header shows title + count badge + "View all" link.
 */
export function QueueCard({ title, count, viewAllTo, emptyMessage, children }: QueueCardProps) {
  return (
    <div className="bg-card border hairline rounded-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b hairline">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-base text-architect">{title}</h3>
          <span className="mono text-[10px] uppercase text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-sm">
            {count}
          </span>
        </div>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="mono text-[10px] uppercase tracking-wider text-gold-deep hover:text-architect inline-flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {count === 0 ? (
        <div className="px-4 py-6 text-center text-sm italic text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}