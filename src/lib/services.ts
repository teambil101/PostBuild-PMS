import type { Database } from "@/integrations/supabase/types";

export type ServiceCategory = Database["public"]["Enums"]["service_category"];
export type ServiceDelivery = Database["public"]["Enums"]["service_delivery"];
export type ServiceBilling = Database["public"]["Enums"]["service_billing"];
export type ServiceCadence = Database["public"]["Enums"]["service_cadence"];
export type ServiceRequestStatus = Database["public"]["Enums"]["service_request_status"];
export type ServiceRequestPriority = Database["public"]["Enums"]["service_request_priority"];
export type ServiceRequestStepStatus = Database["public"]["Enums"]["service_request_step_status"];

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

export const REQUEST_STATUS_LABEL: Record<ServiceRequestStatus, string> = {
  open: "Open",
  scheduled: "Scheduled",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const REQUEST_STATUS_STYLES: Record<ServiceRequestStatus, string> = {
  open: "bg-muted text-architect border-warm-stone/60",
  scheduled: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  in_progress: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  blocked: "bg-destructive/10 text-destructive border-destructive/30",
  completed: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  cancelled: "bg-muted text-muted-foreground border-warm-stone/60 line-through",
};

export const PRIORITY_LABEL: Record<ServiceRequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_STYLES: Record<ServiceRequestPriority, string> = {
  low: "text-muted-foreground",
  normal: "text-architect",
  high: "text-amber-700",
  urgent: "text-destructive",
};

export const STEP_STATUS_LABEL: Record<ServiceRequestStepStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  skipped: "Skipped",
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
