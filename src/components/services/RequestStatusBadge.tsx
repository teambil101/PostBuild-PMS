import { cn } from "@/lib/utils";
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_STYLES, type ServiceRequestStatus } from "@/lib/services";

export function RequestStatusBadge({ status }: { status: ServiceRequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border hairline",
        REQUEST_STATUS_STYLES[status],
      )}
    >
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}