import { EmptyState } from "@/components/EmptyState";
import { ScrollText } from "lucide-react";

export function OwnerStatements() {
  return (
    <EmptyState
      icon={ScrollText}
      title="No owner statements yet"
      description="Monthly per-management-agreement statements will appear here. Statement generation arrives in Phase 4."
    />
  );
}