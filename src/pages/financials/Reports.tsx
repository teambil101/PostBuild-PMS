import { EmptyState } from "@/components/EmptyState";
import { BarChart3 } from "lucide-react";

export function Reports() {
  return (
    <EmptyState
      icon={<BarChart3 className="h-8 w-8" strokeWidth={1.4} />}
      title="Reports"
      description="P&L, balance sheet, AR/AP aging and vendor spend by landlord. Available once data starts flowing — Phase 4."
    />
  );
}