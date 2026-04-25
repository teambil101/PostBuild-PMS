import type { Database } from "@/integrations/supabase/types";

export type VendorServiceQuality = Database["public"]["Enums"]["vendor_service_quality"];
export type BillToMode = Database["public"]["Enums"]["bill_to_mode"];
export type PartyCostApprovalStatus = Database["public"]["Enums"]["party_cost_approval_status"];

export const QUALITY_LABEL: Record<VendorServiceQuality, string> = {
  economy: "Economy",
  standard: "Standard",
  premium: "Premium",
};

export const QUALITY_STYLES: Record<VendorServiceQuality, string> = {
  economy: "bg-muted text-muted-foreground border-warm-stone/60",
  standard: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  premium: "bg-gold/10 text-gold border-gold/40",
};

export const BILL_TO_MODE_LABEL: Record<BillToMode, string> = {
  landlord_only: "Landlord pays",
  tenant_only: "Tenant pays",
  split: "Split between landlord & tenant",
  to_be_negotiated: "To be negotiated",
};

export const BILL_TO_MODE_DESC: Record<BillToMode, string> = {
  landlord_only: "100% billed to the landlord.",
  tenant_only: "100% billed to the tenant.",
  split: "Both parties share the cost in fixed percentages you set now.",
  to_be_negotiated: "Landlord and tenant agree the split via a back-and-forth thread.",
};

export const PARTY_APPROVAL_LABEL: Record<PartyCostApprovalStatus, string> = {
  not_required: "Not required",
  pending: "Awaiting decision",
  approved: "Approved",
  rejected: "Rejected",
};

export const PARTY_APPROVAL_STYLES: Record<PartyCostApprovalStatus, string> = {
  not_required: "bg-muted text-muted-foreground border-warm-stone/60",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  approved: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};