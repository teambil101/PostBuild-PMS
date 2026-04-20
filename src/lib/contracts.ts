import { type LucideIcon, Briefcase, Home, Wrench, Handshake, FileSignature, FileCheck2, Files, FileText } from "lucide-react";

export const CONTRACT_TYPES = [
  "lease",
  "management_agreement",
  "service_agreement",
  "brokerage_agreement",
  "sale_purchase_agreement",
  "noc",
  "addendum",
  "other",
] as const;
export type ContractType = typeof CONTRACT_TYPES[number];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  lease: "Lease",
  management_agreement: "Management Agreement",
  service_agreement: "Service Agreement",
  brokerage_agreement: "Brokerage Agreement",
  sale_purchase_agreement: "Sale / Purchase Agreement",
  noc: "NOC",
  addendum: "Addendum",
  other: "Other",
};

export const CONTRACT_TYPE_ICONS: Record<ContractType, LucideIcon> = {
  lease: Home,
  management_agreement: Briefcase,
  service_agreement: Wrench,
  brokerage_agreement: Handshake,
  sale_purchase_agreement: FileSignature,
  noc: FileCheck2,
  addendum: Files,
  other: FileText,
};

export const CONTRACT_STATUSES = [
  "draft",
  "pending_signature",
  "active",
  "expired",
  "terminated",
  "cancelled",
] as const;
export type ContractStatus = typeof CONTRACT_STATUSES[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  pending_signature: "Pending Signature",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
  cancelled: "Cancelled",
};

/** Tailwind class string for status pill — uses existing semantic tokens / amber for warn states. */
export const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  draft: "bg-warm-stone/40 text-true-taupe border-warm-stone",
  pending_signature: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  active: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  expired: "bg-warm-stone/30 text-muted-foreground border-warm-stone",
  terminated: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-destructive/5 text-destructive/80 border-destructive/20",
};

export const PARTY_ROLES = [
  "landlord",
  "tenant",
  "lessor",
  "lessee",
  "service_provider",
  "client",
  "broker",
  "guarantor",
  "witness",
  "other",
] as const;
export type PartyRole = typeof PARTY_ROLES[number];

/* ============ Management Agreement ============ */

export const FEE_MODELS = [
  "percentage_of_rent",
  "flat_annual",
  "flat_per_unit",
  "hybrid",
] as const;
export type FeeModel = typeof FEE_MODELS[number];

export const FEE_MODEL_LABELS: Record<FeeModel, string> = {
  percentage_of_rent: "Percentage of rent",
  flat_annual: "Flat annual fee",
  flat_per_unit: "Flat per unit per year",
  hybrid: "Hybrid (base + overage %)",
};

export const SCOPE_OF_SERVICES = [
  "tenant_sourcing",
  "rent_collection",
  "maintenance_minor",
  "maintenance_major",
  "financial_reporting",
  "utility_management",
  "inspection_handover",
  "eviction_legal",
  "ejari_registration",
  "insurance_coordination",
  "vendor_management",
  "annual_report",
] as const;
export type ScopeService = typeof SCOPE_OF_SERVICES[number];

export const SCOPE_LABELS: Record<ScopeService, string> = {
  tenant_sourcing: "Tenant sourcing & lease-up",
  rent_collection: "Rent collection",
  maintenance_minor: "Maintenance — minor repairs",
  maintenance_major: "Maintenance — major repairs",
  financial_reporting: "Financial reporting (monthly)",
  utility_management: "Utility management (DEWA)",
  inspection_handover: "Inspection & handover",
  eviction_legal: "Eviction & legal coordination",
  ejari_registration: "Ejari registration",
  insurance_coordination: "Insurance coordination",
  vendor_management: "Vendor management",
  annual_report: "Annual property report",
};

export function formatContractValue(
  fee_model: FeeModel | null | undefined,
  fee_value: number | null | undefined,
  fee_applies_to: string | null | undefined,
  currency = "AED",
): string {
  if (!fee_model || fee_value == null) return "—";
  switch (fee_model) {
    case "percentage_of_rent":
      return `${fee_value}% of ${fee_applies_to === "collected_rent" ? "collected" : "contracted"} rent`;
    case "flat_annual":
      return `${currency} ${Number(fee_value).toLocaleString()} / year`;
    case "flat_per_unit":
      return `${currency} ${Number(fee_value).toLocaleString()} / unit / year`;
    case "hybrid":
      return `Hybrid: base + % overage`;
  }
}

export function summarizePeriod(start?: string | null, end?: string | null): string {
  if (!start && !end) return "No dates set";
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}