import { EmptyState } from "@/components/EmptyState";
import { FileText } from "lucide-react";

export function Receivables() {
  return (
    <EmptyState
      icon={<FileText className="h-8 w-8" strokeWidth={1.4} />}
      title="No invoices yet"
      description="Tenant and landlord invoices will appear here. Auto-generation from active leases ships in Phase 2."
    />
  );
}