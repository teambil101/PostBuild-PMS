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

  // Get prefix
  const { data: settings } = await supabase
    .from("app_settings")
    .select("contract_number_prefix")
    .maybeSingle();
  const prefix = settings?.contract_number_prefix ?? "CTR";
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