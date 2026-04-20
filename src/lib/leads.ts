/* =========================================================
 * Leads module — CRM pipeline for acquiring management clients.
 * Constants, labels, and helper functions.
 * ========================================================= */

export const LEAD_STATUSES = [
  "new",
  "qualified",
  "discovery",
  "proposal",
  "negotiating",
  "on_hold",
  "contract_signed",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  qualified: "Qualified",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiating: "Negotiating",
  on_hold: "On Hold",
  contract_signed: "Contract Signed",
  lost: "Lost",
};

/** Tailwind class string for status pill — uses existing semantic tokens. */
export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-warm-stone/40 text-true-taupe border-warm-stone",
  qualified: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  discovery: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  proposal: "bg-gold/10 text-gold border-gold/30",
  negotiating: "bg-gold/10 text-gold border-gold/30",
  on_hold: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  contract_signed: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  lost: "bg-destructive/5 text-destructive/70 border-destructive/20",
};

/** Order for kanban columns (on_hold is cross-cutting, excluded). */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "new",
  "qualified",
  "discovery",
  "proposal",
  "negotiating",
  "contract_signed",
  "lost",
];

/** Status options selectable in the generic Change Stage dialog. */
export const LEAD_CHANGEABLE_STATUSES: LeadStatus[] = [
  "new",
  "qualified",
  "discovery",
  "proposal",
  "negotiating",
];

export const TERMINAL_STATUSES: LeadStatus[] = ["contract_signed", "lost"];

/* =========================================================
 * Sources
 * ========================================================= */

export const LEAD_SOURCES = [
  "referral",
  "inbound",
  "cold_outreach",
  "event",
  "website",
  "broker_intro",
  "partner",
  "other",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  referral: "Referral",
  inbound: "Inbound enquiry",
  cold_outreach: "Cold outreach",
  event: "Event",
  website: "Website",
  broker_intro: "Broker intro",
  partner: "Partner",
  other: "Other",
};

export const LEAD_SOURCE_DETAIL_HELPERS: Record<LeadSource, string> = {
  referral: "Who referred them?",
  event: "Which event?",
  broker_intro: "Which broker?",
  partner: "Which partner?",
  inbound: "How did they reach out? (email, call, form…)",
  cold_outreach: "What channel? (email, LinkedIn, call…)",
  website: "Page or campaign, if known",
  other: "Add any context that explains the source.",
};

/* =========================================================
 * Lost reasons
 * ========================================================= */

export const LEAD_LOST_REASONS = [
  "price",
  "scope_mismatch",
  "chose_competitor",
  "timing",
  "withdrew",
  "unresponsive",
  "other",
] as const;
export type LeadLostReason = (typeof LEAD_LOST_REASONS)[number];

export const LEAD_LOST_REASON_LABELS: Record<LeadLostReason, string> = {
  price: "Price",
  scope_mismatch: "Scope mismatch",
  chose_competitor: "Chose competitor",
  timing: "Timing",
  withdrew: "Withdrew",
  unresponsive: "Unresponsive",
  other: "Other",
};

/* =========================================================
 * Row type
 * ========================================================= */

export interface LeadRow {
  id: string;
  lead_number: string;
  primary_contact_id: string;
  company_id: string | null;
  source: LeadSource;
  source_details: string | null;
  status: LeadStatus;
  stage_entered_at: string;
  assignee_id: string | null;
  property_count_estimated: number | null;
  portfolio_description: string | null;
  estimated_annual_fee: number | null;
  currency: string;
  probability_percent: number | null;
  target_close_date: string | null;
  proposed_fee_model: string | null;
  proposed_fee_value: number | null;
  proposed_fee_applies_to: string | null;
  proposed_duration_months: number | null;
  proposed_scope_of_services: string[];
  proposed_terms_notes: string | null;
  won_contract_id: string | null;
  won_at: string | null;
  lost_reason: LeadLostReason | null;
  lost_reason_notes: string | null;
  lost_at: string | null;
  hold_reason: string | null;
  hold_since: string | null;
  pre_hold_status: LeadStatus | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/* =========================================================
 * Date helpers
 * ========================================================= */

/** Whole days since stage_entered_at. */
export function getStageAgingDays(lead: Pick<LeadRow, "stage_entered_at">): number {
  const entered = new Date(lead.stage_entered_at).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - entered) / (1000 * 60 * 60 * 24)));
}

/** Stuck = in proposal/negotiating beyond `threshold` days (default 14). */
export function isStageStuck(
  lead: Pick<LeadRow, "status" | "stage_entered_at">,
  threshold = 14,
): boolean {
  if (lead.status !== "proposal" && lead.status !== "negotiating") return false;
  return getStageAgingDays(lead) > threshold;
}

/** Days until target close (negative = overdue). Null if no target set. */
export function getDaysToClose(targetIso: string | null): number | null {
  if (!targetIso) return null;
  const target = new Date(targetIso + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* =========================================================
 * Value formatters
 * ========================================================= */

/** "AED 75,000/yr × 60% = AED 45,000" or partial if missing pieces. */
export function formatEstimatedValue(
  lead: Pick<LeadRow, "estimated_annual_fee" | "probability_percent" | "currency">,
): string {
  const fee = lead.estimated_annual_fee;
  const prob = lead.probability_percent;
  const cur = lead.currency || "AED";
  if (fee == null) return "—";
  const base = `${cur} ${Number(fee).toLocaleString()}/yr`;
  if (prob == null) return base;
  return `${base} × ${prob}%`;
}

/** Weighted = estimated_annual_fee × (probability_percent / 100). */
export function getWeightedValue(
  lead: Pick<LeadRow, "estimated_annual_fee" | "probability_percent">,
): number {
  if (lead.estimated_annual_fee == null) return 0;
  const prob = lead.probability_percent ?? 0;
  return Number(lead.estimated_annual_fee) * (prob / 100);
}

/** Pipeline value across many leads (active only — caller filters). */
export function getWeightedPipelineValue(
  leads: Pick<LeadRow, "estimated_annual_fee" | "probability_percent" | "status">[],
): number {
  return leads
    .filter((l) => !TERMINAL_STATUSES.includes(l.status))
    .reduce((sum, l) => sum + getWeightedValue(l), 0);
}

/* =========================================================
 * Aging color (for stage-aging indicators)
 * ========================================================= */

export type AgingTone = "fresh" | "warming" | "stale";

export function getStageAgingTone(
  lead: Pick<LeadRow, "status" | "stage_entered_at">,
): AgingTone {
  if (!["proposal", "negotiating"].includes(lead.status)) return "fresh";
  const days = getStageAgingDays(lead);
  if (days > 14) return "stale";
  if (days >= 7) return "warming";
  return "fresh";
}

export function agingToneClasses(tone: AgingTone): string {
  switch (tone) {
    case "stale":
      return "text-destructive";
    case "warming":
      return "text-amber-700";
    default:
      return "text-muted-foreground";
  }
}

/* =========================================================
 * Quarter helpers (for "Won this quarter" KPI)
 * ========================================================= */

export function startOfCurrentQuarterIso(): string {
  const now = new Date();
  const month = now.getMonth();
  const qStartMonth = month - (month % 3);
  const d = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0, 0);
  return d.toISOString();
}
