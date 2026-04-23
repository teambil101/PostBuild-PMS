import type { Database } from "@/integrations/supabase/types";

export type ServiceCategory = Database["public"]["Enums"]["service_category"];
export type ServiceDelivery = Database["public"]["Enums"]["service_delivery"];
export type ServiceBilling = Database["public"]["Enums"]["service_billing"];
export type ServiceCadence = Database["public"]["Enums"]["service_cadence"];

export const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  maintenance: "Maintenance",
  inspection: "Inspection",
  tenant_lifecycle: "Tenant lifecycle",
  leasing: "Leasing",
  compliance: "Compliance",
  cleaning: "Cleaning",
  utilities: "Utilities",
  administrative: "Administrative",
  other: "Other",
};

export const DELIVERY_LABEL: Record<ServiceDelivery, string> = {
  vendor: "Vendor",
  staff: "Staff",
  either: "Either",
};

export const BILLING_LABEL: Record<ServiceBilling, string> = {
  free: "Free",
  paid: "Paid",
  pass_through: "Pass-through",
};

export const CADENCE_LABEL: Record<ServiceCadence, string> = {
  one_off: "On request",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  biannual: "Bi-annual",
  annual: "Annual",
  custom: "Custom interval",
};

export const BILLING_STYLES: Record<ServiceBilling, string> = {
  free: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  paid: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  pass_through: "bg-muted text-muted-foreground border-warm-stone/60",
};

export interface WorkflowStep {
  key: string;
  title: string;
  category: ServiceCategory;
  default_delivery: ServiceDelivery;
  default_billing: ServiceBilling;
  typical_duration_days: number | null;
  blocks_next: boolean;
}

export const EMPTY_STEP: WorkflowStep = {
  key: "",
  title: "",
  category: "tenant_lifecycle",
  default_delivery: "staff",
  default_billing: "free",
  typical_duration_days: null,
  blocks_next: false,
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
