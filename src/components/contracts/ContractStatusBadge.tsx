import { cn } from "@/lib/utils";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_STYLES, type ContractStatus } from "@/lib/contracts";

export function ContractStatusBadge({ status, className }: { status: ContractStatus | string; className?: string }) {
  const key = (status as ContractStatus) in CONTRACT_STATUS_LABEL ? (status as ContractStatus) : "draft";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium",
        CONTRACT_STATUS_STYLES[key],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {CONTRACT_STATUS_LABEL[key]}
    </span>
  );
}