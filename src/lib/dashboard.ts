// Dashboard RPC types + helpers.
// Mirror of the JSON shape returned by `get_operations_dashboard` and
// `get_management_dashboard` SECURITY DEFINER functions.

export interface OperationsKpis {
  my_open_tickets: { total: number; urgent: number; overdue: number };
  my_leads: { total: number; stuck: number };
  tickets_awaiting_me: { total: number; waiting_over_3_days: number };
  cheques_due_this_week: { count: number; total_amount: number; currency: string };
  workflow_steps_blocked: number;
  overdue_on_my_plate: { tickets: number; leads: number; total: number };
}

export interface OperationsQueues {
  urgent_tickets: Array<{
    id: string;
    ticket_number: string;
    subject: string;
    priority: string;
    status: string;
    due_date: string | null;
    created_at: string;
    target_label: string | null;
  }>;
  my_leads_follow_up: Array<{
    id: string;
    lead_number: string;
    contact_name: string | null;
    company_name: string | null;
    status: string;
    stage_age_days: number;
    target_close_date: string | null;
  }>;
  cheques_due_this_week: Array<{
    id: string;
    lease_contract_number: string | null;
    amount: number;
    due_date: string;
    days_until_due: number;
  }>;
  awaiting_my_response: Array<{
    id: string;
    ticket_number: string;
    subject: string;
    waiting_on: string | null;
    days_waiting: number;
  }>;
}

export interface OperationsDashboard {
  person_id: string | null;
  has_linked_person: boolean;
  kpis: OperationsKpis;
  queues: OperationsQueues;
}

export interface ManagementKpis {
  units_managed: { total: number; delta_this_period: number | null };
  occupancy_rate: { percent: number; delta: number | null; occupied: number; total: number };
  annualized_rent_roll: { amount: number; currency: string; delta: number | null };
  annualized_pm_fees: { amount: number; currency: string; active_agreements: number };
  active_leases: { total: number; expiring_90d: number };
  open_tickets: { total: number; urgent: number };
  weighted_pipeline_value: { amount: number; currency: string };
  attention_score: number;
}

export interface AttentionTopItem {
  id: string;
  label: string;
  secondary?: string | null;
  href?: string;
}

export interface ManagementAttention {
  overdue_cheques: { count: number; total_amount: number; currency: string; top_5: AttentionTopItem[] };
  leases_expiring: { in_30d: number; in_60d: number; in_90d: number; top_5: AttentionTopItem[] };
  stuck_leads: { count: number; weighted_value: number; currency: string; top_5: AttentionTopItem[] };
  compliance_expiring: {
    mgmt_agreements_60d: number;
    vendor_trade_license_60d: number;
    vendor_insurance_60d: number;
  };
  data_gaps: {
    units_without_owners: number;
    occupied_no_lease: number;
    unlinked_auth_users: number;
  };
  aging_tickets: { count_over_30_days: number; top_5: AttentionTopItem[] };
}

export interface ManagementDashboard {
  kpis: ManagementKpis;
  attention_items: ManagementAttention;
}

/** Compact "1.2k" / "3.4M" formatter — used in big KPI numbers. */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) < 1000) return String(Math.round(n));
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Compact currency formatter ("AED 1.2M") — used in big KPI numbers where a full
 *  currency string would overflow the card. */
export function formatCurrencyCompact(
  n: number | null | undefined,
  currency = "USD",
): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) < 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** Days from today to a yyyy-mm-dd date string. Negative = overdue. */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function attentionScoreTone(score: number): "ok" | "warn" | "alert" {
  if (score === 0) return "ok";
  if (score <= 10) return "warn";
  return "alert";
}