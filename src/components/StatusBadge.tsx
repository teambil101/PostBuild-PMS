import { cn } from "@/lib/utils";
import { formatEnumLabel } from "@/lib/format";

type Status =
  | "vacant"
  | "occupied"
  | "maintenance"
  | "under_maintenance"
  | "off_market"
  | "reserved";

const STYLES: Record<Status, string> = {
  vacant: "bg-status-vacant/10 text-status-vacant border-status-vacant/30",
  occupied: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  maintenance: "bg-status-maintenance/10 text-status-maintenance border-status-maintenance/30",
  under_maintenance: "bg-status-maintenance/10 text-status-maintenance border-status-maintenance/30",
  off_market: "bg-status-offmarket/10 text-status-offmarket border-status-offmarket/30",
  reserved: "bg-amber-500/10 text-amber-700 border-amber-500/30",
};

export function StatusBadge({ status, className }: { status: Status | string; className?: string }) {
  const key = (status as Status) in STYLES ? (status as Status) : "vacant";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium",
        STYLES[key],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {formatEnumLabel(status)}
    </span>
  );
}
