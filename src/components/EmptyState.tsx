import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border hairline rounded-sm bg-card px-8 py-16 text-center flex flex-col items-center gap-4",
        className,
      )}
    >
      {icon && <div className="text-true-taupe">{icon}</div>}
      <div className="space-y-1.5 max-w-md">
        <h3 className="font-display text-2xl text-architect">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
