import { EmptyState } from "@/components/EmptyState";
import { ScrollText } from "lucide-react";

export function OwnerStatements() {
  return (
    <EmptyState
      icon={<ScrollText className="h-8 w-8" strokeWidth={1.4} />}
      title="No owner statements yet"
      description="Monthly per-management-agreement statements will appear here. Statement generation arrives in Phase 4."
    />
  );
}