import type { Database } from "@/integrations/supabase/types";

export type ServiceCategory = Database["public"]["Enums"]["service_category"];
export type ServiceDelivery = Database["public"]["Enums"]["service_delivery"];
export type ServiceBilling = Database["public"]["Enums"]["service_billing"];
export type ServiceCadence = Database["public"]["Enums"]["service_cadence"];
export type ServiceRequestStatus = Database["public"]["Enums"]["service_request_status"];
export type ServiceRequestPriority = Database["public"]["Enums"]["service_request_priority"];
export type ServiceRequestStepStatus = Database["public"]["Enums"]["service_request_step_status"];
export type ServiceRequestApprovalStatus = Database["public"]["Enums"]["service_request_approval_status"];

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

export const APPROVAL_STATUS_LABEL: Record<ServiceRequestApprovalStatus, string> = {
  not_required: "No approval needed",
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const APPROVAL_STATUS_STYLES: Record<ServiceRequestApprovalStatus, string> = {
  not_required: "bg-muted text-muted-foreground border-warm-stone/60",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  approved: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

export interface WorkflowStep {
  key: string;
  /** ID of the catalog service this step references (chained workflow). */
  catalog_id: string;
  /** Optional: override the catalog entry's display name for this step. */
  title_override?: string | null;
  /** Optional: override the catalog entry's typical duration for this step. */
  duration_override_days?: number | null;
  blocks_next: boolean;

  /** Optional default assignee for this step (staff/internal person). */
  assigned_person_id?: string | null;
  /** Optional default assignee for this step (vendor). */
  assigned_vendor_id?: string | null;

  // ---- Legacy fields (pre-chaining) — kept optional for backwards compat. ----
  /** @deprecated Use catalog_id + title_override instead. */
  title?: string;
  /** @deprecated Inherited from referenced catalog entry. */
  category?: ServiceCategory;
  /** @deprecated Inherited from referenced catalog entry. */
  category_other?: string | null;
  /** @deprecated Inherited from referenced catalog entry. */
  default_delivery?: ServiceDelivery;
  /** @deprecated Inherited from referenced catalog entry. */
  default_billing?: ServiceBilling;
  /** @deprecated Use duration_override_days instead. */
  typical_duration_days?: number | null;
}

export const EMPTY_STEP: WorkflowStep = {
  key: "",
  catalog_id: "",
  title_override: null,
  duration_override_days: null,
  blocks_next: false,
  assigned_person_id: null,
  assigned_vendor_id: null,
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
