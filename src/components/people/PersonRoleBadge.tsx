import { cn } from "@/lib/utils";

type Role = "tenant" | "owner" | "prospect" | "staff" | "vendor";

const STYLES: Record<Role, string> = {
  tenant: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  owner: "bg-gold/15 text-smoked-bronze border-gold/40",
  prospect: "bg-status-vacant/10 text-status-vacant border-status-vacant/30",
  staff: "bg-architect/10 text-architect border-architect/30",
  vendor: "bg-true-taupe/15 text-smoked-bronze border-true-taupe/30",
};

export function PersonRoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium",
        STYLES[role],
        className,
      )}
    >
      {role}
    </span>
  );
}
