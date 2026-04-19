import { cn } from "@/lib/utils";

type Status = "vacant" | "occupied" | "maintenance" | "off_market";

const LABELS: Record<Status, string> = {
  vacant: "Vacant",
  occupied: "Occupied",
  maintenance: "Maintenance",
  off_market: "Off Market",
};

const STYLES: Record<Status, string> = {
  vacant: "bg-status-vacant/10 text-status-vacant border-status-vacant/30",
  occupied: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  maintenance: "bg-status-maintenance/10 text-status-maintenance border-status-maintenance/30",
  off_market: "bg-status-offmarket/10 text-status-offmarket border-status-offmarket/30",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium",
        STYLES[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status]}
    </span>
  );
}
