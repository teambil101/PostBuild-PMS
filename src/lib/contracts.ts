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
  "service_provider",
  "client",
  "broker",
  "guarantor",
  "seller",
  "buyer",
  "issuer",
  "recipient",
  "other",
] as const;
export type PartyRole = typeof PARTY_ROLES[number];

/**
 * Returns the contextually-allowed party roles for a given contract type.
 * For "addendum", pass the parent contract's type as `parentType`.
 */
export function getAllowedPartyRoles(
  contractType: string,
  parentType?: string | null,
): PartyRole[] {
  switch (contractType) {
    case "management_agreement":
    case "service_agreement":
      return ["service_provider", "client", "other"];
    case "lease":
      return ["landlord", "tenant", "broker", "guarantor", "other"];
    case "brokerage_agreement":
      return ["broker", "client", "other"];
    case "sale_purchase_agreement":
      return ["seller", "buyer", "broker", "other"];
    case "noc":
      return ["issuer", "recipient", "other"];
    case "addendum":
      return parentType ? getAllowedPartyRoles(parentType) : [...PARTY_ROLES];
    case "other":
    default:
      return [...PARTY_ROLES];
  }
}

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

/* ============ Service Agreement ============ */

export const SERVICE_FEE_MODELS = [
  "fixed_monthly",
  "fixed_annual",
  "per_call",
  "per_unit",
  "hybrid",
  "time_and_materials",
  "quote_based",
] as const;
export type ServiceFeeModel = typeof SERVICE_FEE_MODELS[number];

export const SERVICE_FEE_MODEL_LABELS: Record<ServiceFeeModel, string> = {
  fixed_monthly: "Fixed monthly fee",
  fixed_annual: "Fixed annual fee",
  per_call: "Per-call (pay per visit)",
  per_unit: "Per-unit",
  hybrid: "Hybrid (flat + per-call/unit)",
  time_and_materials: "Time & materials",
  quote_based: "Quote-based (per job)",
};

export const SERVICE_FREQUENCIES = [
  "on_demand",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semi_annually",
  "annually",
] as const;
export type ServiceFrequency = typeof SERVICE_FREQUENCIES[number];

export const SERVICE_FREQUENCY_LABELS: Record<ServiceFrequency, string> = {
  on_demand: "On-demand",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annually: "Semi-annual",
  annually: "Annual",
};

export const SERVICE_SCOPES = [
  "preventive_maintenance",
  "reactive_maintenance",
  "emergency_response",
  "cleaning",
  "pest_control",
  "landscaping",
  "security_services",
  "elevator_maintenance",
  "hvac_maintenance",
  "plumbing_services",
  "electrical_services",
  "painting",
  "pool_maintenance",
  "fire_safety",
  "waste_management",
  "other",
] as const;
export type ServiceScope = typeof SERVICE_SCOPES[number];

export const SERVICE_SCOPE_LABELS: Record<ServiceScope, string> = {
  preventive_maintenance: "Preventive maintenance",
  reactive_maintenance: "Reactive maintenance",
  emergency_response: "Emergency response",
  cleaning: "Cleaning",
  pest_control: "Pest control",
  landscaping: "Landscaping",
  security_services: "Security services",
  elevator_maintenance: "Elevator maintenance",
  hvac_maintenance: "HVAC maintenance",
  plumbing_services: "Plumbing services",
  electrical_services: "Electrical services",
  painting: "Painting",
  pool_maintenance: "Pool maintenance",
  fire_safety: "Fire safety",
  waste_management: "Waste management",
  other: "Other",
};

/** Compact one-line summary for cards / tables. */
export function formatServiceFee(
  fee_model: ServiceFeeModel | null | undefined,
  fields: {
    fee_value?: number | null;
    hybrid_base_monthly?: number | null;
    hybrid_per_call_or_unit?: number | null;
    hybrid_mode?: string | null;
    hourly_rate?: number | null;
    materials_markup_percent?: number | null;
    subjects_count?: number;
  } = {},
  currency = "AED",
): string {
  if (!fee_model) return "—";
  const n = (v: number | null | undefined) =>
    v == null ? "—" : `${currency} ${Number(v).toLocaleString()}`;
  switch (fee_model) {
    case "fixed_monthly":
      return `${n(fields.fee_value)} / month`;
    case "fixed_annual":
      return `${n(fields.fee_value)} / year`;
    case "per_call":
      return `${n(fields.fee_value)} / call`;
    case "per_unit": {
      const base = `${n(fields.fee_value)} / unit`;
      if (fields.subjects_count && fields.fee_value != null) {
        const total = Number(fields.fee_value) * fields.subjects_count;
        return `${base} (×${fields.subjects_count} = ${currency} ${total.toLocaleString()})`;
      }
      return base;
    }
    case "hybrid":
      return `${n(fields.hybrid_base_monthly)}/mo + ${n(fields.hybrid_per_call_or_unit)} ${
        fields.hybrid_mode === "per_unit" ? "/unit" : "/call"
      }`;
    case "time_and_materials":
      return `${n(fields.hourly_rate)}/hr${
        fields.materials_markup_percent != null
          ? ` + ${fields.materials_markup_percent}% materials`
          : ""
      }`;
    case "quote_based":
      return "Quote-based";
  }
}

/* ============ Duplicate helper ============ */

import { supabase } from "@/integrations/supabase/client";

/**
 * Duplicates a contract (parent + child + parties + subjects) as a fresh draft.
 * Returns the new contract id, or throws.
 * - Title prefixed with "Copy of "
 * - Status reset to 'draft'
 * - start_date / end_date / terminated_at cleared
 * - documents / notes / events NOT copied
 */
export async function duplicateContract(contractId: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const { data: src, error: srcErr } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  if (srcErr || !src) throw new Error(srcErr?.message ?? "Original contract not found.");

  // Lease subtype uses its own counter (LSE-YYYY-NNNN). All others fall back
  // to the configured global prefix (default CTR), preserving prior behavior.
  let prefix: string;
  if (src.contract_type === "lease") {
    prefix = "LSE";
  } else {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("contract_number_prefix")
      .maybeSingle();
    prefix = settings?.contract_number_prefix ?? "CTR";
  }
  const year = new Date().getFullYear();
  const { data: numRes, error: numErr } = await supabase.rpc("next_number", {
    p_prefix: prefix,
    p_year: year,
  });
  if (numErr || !numRes) throw new Error("Could not generate new contract number.");

  const { data: created, error: cErr } = await supabase
    .from("contracts")
    .insert({
      contract_type: src.contract_type,
      contract_number: numRes as string,
      title: `Copy of ${src.title}`,
      currency: src.currency,
      auto_renew: src.auto_renew,
      total_value: src.total_value,
      notes: src.notes,
      external_reference: null,
      status: "draft",
      start_date: null,
      end_date: null,
      parent_contract_id: null,
      created_by: u.user?.id,
    })
    .select("id")
    .maybeSingle();
  if (cErr || !created) throw new Error(cErr?.message ?? "Could not create duplicate.");
  const newId = created.id as string;

  // MA child
  if (src.contract_type === "management_agreement") {
    const { data: ma } = await supabase
      .from("management_agreements")
      .select("*")
      .eq("contract_id", contractId)
      .maybeSingle();
    if (ma) {
      const { id: _ignore, contract_id: _ignore2, created_at: _ignore3, updated_at: _ignore4, ...rest } = ma as any;
      await supabase.from("management_agreements").insert({ ...rest, contract_id: newId });
    }
  }

  // Lease child — copy structural fields, reset transactional state, no cheques.
  if (src.contract_type === "lease") {
    const { duplicateLeaseExtras } = await import("@/lib/leases");
    await duplicateLeaseExtras({ sourceContractId: contractId, newContractId: newId });
  }

  // Parties
  const { data: parties } = await supabase
    .from("contract_parties")
    .select("person_id, role, is_signatory")
    .eq("contract_id", contractId);
  if (parties && parties.length > 0) {
    await supabase.from("contract_parties").insert(
      parties.map((p: any) => ({
        contract_id: newId,
        person_id: p.person_id,
        role: p.role,
        is_signatory: p.is_signatory,
      })),
    );
  }

  // Subjects
  const { data: subjects } = await supabase
    .from("contract_subjects")
    .select("entity_type, entity_id, role")
    .eq("contract_id", contractId);
  if (subjects && subjects.length > 0) {
    await supabase.from("contract_subjects").insert(
      subjects.map((s: any) => ({
        contract_id: newId,
        entity_type: s.entity_type,
        entity_id: s.entity_id,
        role: s.role ?? "subject",
      })),
    );
  }

  await supabase.from("contract_events").insert({
    contract_id: newId,
    event_type: "created",
    to_value: "draft",
    description: `Duplicated from ${src.contract_number}`,
    actor_id: u.user?.id,
  });

  return newId;
}