import { cn } from "@/lib/utils";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_STYLES,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_STYLES,
  COST_APPROVAL_STATUS_LABELS,
  COST_APPROVAL_STATUS_STYLES,
  type TicketStatus,
  type TicketPriority,
  type CostApprovalStatus,
} from "@/lib/tickets";

const PILL_BASE =
  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium whitespace-nowrap";

export function TicketStatusPill({
  status,
  className,
}: {
  status: TicketStatus | string;
  className?: string;
}) {
  const key = (status as TicketStatus) in TICKET_STATUS_LABELS ? (status as TicketStatus) : "open";
  return (
    <span className={cn(PILL_BASE, TICKET_STATUS_STYLES[key], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {TICKET_STATUS_LABELS[key]}
    </span>
  );
}

export function TicketPriorityPill({
  priority,
  className,
}: {
  priority: TicketPriority | string;
  className?: string;
}) {
  const key =
    (priority as TicketPriority) in TICKET_PRIORITY_LABELS
      ? (priority as TicketPriority)
      : "medium";
  return (
    <span className={cn(PILL_BASE, "px-1.5 py-px text-[9px]", TICKET_PRIORITY_STYLES[key], className)}>
      {TICKET_PRIORITY_LABELS[key]}
    </span>
  );
}

export function CostApprovalPill({
  status,
  className,
}: {
  status: CostApprovalStatus | string;
  className?: string;
}) {
  const key =
    (status as CostApprovalStatus) in COST_APPROVAL_STATUS_LABELS
      ? (status as CostApprovalStatus)
      : "not_required";
  return (
    <span className={cn(PILL_BASE, COST_APPROVAL_STATUS_STYLES[key], className)}>
      {COST_APPROVAL_STATUS_LABELS[key]}
    </span>
  );
}