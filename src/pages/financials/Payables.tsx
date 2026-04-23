import { EmptyState } from "@/components/EmptyState";
import { Receipt } from "lucide-react";

export function Payables() {
  return (
    <EmptyState
      icon={Receipt}
      title="No bills yet"
      description="Vendor bills, refund bills, and owner remittance bills will appear here. Phase 3 enables vendor billing from service requests."
    />
  );
}