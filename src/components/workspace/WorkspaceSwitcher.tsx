import { Check, ChevronsUpDown, Building2, User2, Briefcase } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace, type WorkspaceKind } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<WorkspaceKind, typeof Building2> = {
  internal: Building2,
  owner: User2,
  broker: Briefcase,
};

const KIND_LABEL: Record<WorkspaceKind, string> = {
  internal: "Operator",
  owner: "Owner",
  broker: "Broker",
};

/**
 * Header workspace switcher. Hidden when the user belongs to a single workspace
 * (which is the case for everyone today, until owners and brokers are onboarded).
 */
export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActive, loading } = useWorkspace();

  if (loading || !activeWorkspace) return null;
  if (workspaces.length <= 1) return null;

  const ActiveIcon = KIND_ICON[activeWorkspace.kind];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-sm border border-warm-stone/60 px-2.5 py-1.5 hover:bg-muted/50 transition-colors max-w-[220px]"
          aria-label="Switch workspace"
        >
          <ActiveIcon className="h-3.5 w-3.5 text-architect/70 shrink-0" strokeWidth={1.5} />
          <span className="text-sm text-architect truncate">{activeWorkspace.name}</span>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="label-eyebrow text-muted-foreground">
          Switch workspace
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => {
          const Icon = KIND_ICON[w.kind];
          const isActive = w.id === activeWorkspace.id;
          return (
            <DropdownMenuItem
              key={w.id}
              onClick={() => setActive(w.id)}
              className="cursor-pointer"
            >
              <Icon className="h-4 w-4 mr-2 text-architect/70" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm truncate", isActive && "font-medium")}>{w.name}</div>
                <div className="mono text-[10px] uppercase text-muted-foreground">
                  {KIND_LABEL[w.kind]} · {w.plan}
                </div>
              </div>
              {isActive && <Check className="h-4 w-4 ml-2 text-gold" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}