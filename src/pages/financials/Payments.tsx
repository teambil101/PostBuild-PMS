import { EmptyState } from "@/components/EmptyState";
import { Banknote } from "lucide-react";

export function Payments() {
  return (
    <EmptyState
      icon={Banknote}
      title="No payments yet"
      description="Money in and out — cash, cheques, transfers — will appear here. Recording payments arrives in Phase 2."
    />
  );
}