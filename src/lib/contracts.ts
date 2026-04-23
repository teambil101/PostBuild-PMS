import type { Database } from "@/integrations/supabase/types";

export type ContractType = Database["public"]["Enums"]["contract_type"];
export type ContractStatus = Database["public"]["Enums"]["contract_status"];
export type ContractPartyRole = Database["public"]["Enums"]["contract_party_role"];
export type MaFeeModel = Database["public"]["Enums"]["ma_fee_model"];
export type MaApprovalRule = Database["public"]["Enums"]["ma_approval_rule"];
export type VsaRateModel = Database["public"]["Enums"]["vsa_rate_model"];
export type VsaPaymentTerms = Database["public"]["Enums"]["vsa_payment_terms"];

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

export type LeaseRentFrequency = "annual" | "monthly" | "quarterly";
export type LeasePaymentMethod = "cheque" | "bank_transfer" | "cash" | "card";
export type LeaseDepositHolder = "pm_company" | "landlord";
export type LeaseCommissionPayer = "tenant" | "landlord" | "split";

export const RENT_FREQUENCY_LABEL: Record<LeaseRentFrequency, string> = {
  annual: "Annual",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export const PAYMENT_METHOD_LABEL: Record<LeasePaymentMethod, string> = {
  cheque: "Cheque",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
};

export const DEPOSIT_HOLDER_LABEL: Record<LeaseDepositHolder, string> = {
  pm_company: "PM company",
  landlord: "Landlord",
};

export const COMMISSION_PAYER_LABEL: Record<LeaseCommissionPayer, string> = {
  tenant: "Tenant",
  landlord: "Landlord",
  split: "Split 50/50",
};

export const VSA_RATE_MODEL_LABEL: Record<VsaRateModel, string> = {
  per_call_out: "Per call-out",
  per_hour: "Per hour",
  fixed_per_visit: "Fixed per visit",
  quote_required: "Quote required each time",
  hybrid: "Hybrid (call-out + hourly)",
};

export const VSA_PAYMENT_TERMS_LABEL: Record<VsaPaymentTerms, string> = {
  on_completion: "On completion",
  net_7: "NET 7",
  net_15: "NET 15",
  net_30: "NET 30",
  net_60: "NET 60",
  monthly_invoice: "Monthly invoice",
  custom: "Custom",
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