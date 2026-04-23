import type { Database } from "@/integrations/supabase/types";

export type ContractType = Database["public"]["Enums"]["contract_type"];
export type ContractStatus = Database["public"]["Enums"]["contract_status"];
export type ContractPartyRole = Database["public"]["Enums"]["contract_party_role"];
export type MaFeeModel = Database["public"]["Enums"]["ma_fee_model"];
export type MaApprovalRule = Database["public"]["Enums"]["ma_approval_rule"];

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  management_agreement: "Management Agreement",
  lease: "Lease",
  vendor_service_agreement: "Vendor Service Agreement",
};

export const CONTRACT_TYPE_PREFIX: Record<ContractType, string> = {
  management_agreement: "CTR",
  lease: "LSE",
  vendor_service_agreement: "VSA",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Draft",
  pending_signature: "Pending Signature",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
  cancelled: "Cancelled",
};

export const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  draft: "bg-muted text-muted-foreground border-warm-stone/60",
  pending_signature: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  active: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  expired: "bg-status-offmarket/10 text-status-offmarket border-status-offmarket/30",
  terminated: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-warm-stone/60",
};

export const FEE_MODEL_LABEL: Record<MaFeeModel, string> = {
  percent_of_rent: "% of collected rent",
  flat_annual: "Flat annual fee",
  flat_per_unit: "Flat per unit / year",
  hybrid: "Hybrid (base + %)",
};

export const APPROVAL_RULE_LABEL: Record<MaApprovalRule, string> = {
  auto_threshold: "Auto-approve under threshold",
  always_required: "Always require landlord approval",
  auto_all: "Auto-approve all paid work",
};

/**
 * Default catalog of free services that can be included in a Management Agreement.
 * Mirrors common PM scope items. Stored as a checklist on `included_services`.
 */
export const INCLUDED_SERVICES_CATALOG: { key: string; label: string; description?: string }[] = [
  { key: "tenant_search", label: "Tenant search & onboarding", description: "Listing, viewings, contracting, utilities, handover" },
  { key: "tenant_doc_collection", label: "Tenant document collection" },
  { key: "biannual_inspection", label: "Bi-annual property inspection" },
  { key: "annual_inspection", label: "Annual property inspection" },
  { key: "rent_collection", label: "Rent collection & receipt management" },
  { key: "cheque_management", label: "Cheque deposit & tracking" },
  { key: "lease_renewal", label: "Lease renewal management" },
  { key: "ejari_renewal", label: "Ejari renewal" },
  { key: "move_in_inspection", label: "Move-in inspection" },
  { key: "move_out_inspection", label: "Move-out inspection & deposit settlement" },
  { key: "vendor_coordination", label: "Vendor coordination & quote sourcing" },
  { key: "monthly_reporting", label: "Monthly owner reporting" },
  { key: "compliance_reminders", label: "Compliance & document expiry reminders" },
];