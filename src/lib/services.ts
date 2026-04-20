/* =========================================================
 * Services module — recurring service schedules.
 * Constants, labels, and date math helpers.
 * ========================================================= */

export const FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semi_annually",
  "annually",
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annually: "Semi-annual",
  annually: "Annual",
};

export const FREQUENCY_INTERVAL_DAYS: Record<Frequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
  semi_annually: 183,
  annually: 365,
};

export const SCHEDULE_STATUSES = ["active", "paused", "ended"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const STATUS_LABELS: Record<ScheduleStatus, string> = {
  active: "Active",
  paused: "Paused",
  ended: "Ended",
};

export const STATUS_STYLES: Record<ScheduleStatus, string> = {
  active: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  paused: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  ended: "bg-warm-stone/30 text-muted-foreground border-warm-stone",
};

/* =========================================================
 * Date math
 * ========================================================= */

function lastDayOfMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

/**
 * Calendar-aware add. Preserves day-of-month when possible; clamps to the
 * last day of the target month when the source day exceeds it.
 */
function addCalendarMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  const targetMonthIdx = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIdx / 12);
  const targetMonth = ((targetMonthIdx % 12) + 12) % 12;
  const day = Math.min(d, lastDayOfMonth(targetYear, targetMonth));
  const mm = String(targetMonth + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

function addDays(iso: string, days: number): string {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function computeNextDueDate(currentIso: string, frequency: Frequency): string {
  switch (frequency) {
    case "weekly":
      return addDays(currentIso, 7);
    case "biweekly":
      return addDays(currentIso, 14);
    case "monthly":
      return addCalendarMonths(currentIso, 1);
    case "quarterly":
      return addCalendarMonths(currentIso, 3);
    case "semi_annually":
      return addCalendarMonths(currentIso, 6);
    case "annually":
      return addCalendarMonths(currentIso, 12);
  }
}

/* =========================================================
 * Urgency
 * ========================================================= */

export type ScheduleUrgency = "not_due" | "due_soon" | "due_now" | "overdue";

export function getScheduleUrgency(
  nextDueIso: string,
  leadTimeDays: number,
): ScheduleUrgency {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueIso + "T00:00:00");
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < -leadTimeDays) return "overdue";
  if (diffDays <= 0) return "due_now";
  if (diffDays <= leadTimeDays) return "due_soon";
  return "not_due";
}

export function urgencyTone(u: ScheduleUrgency): string {
  switch (u) {
    case "overdue":
      return "text-destructive";
    case "due_now":
    case "due_soon":
      return "text-amber-700";
    default:
      return "text-muted-foreground";
  }
}

/** Short relative phrasing: "Due in 3d", "Today", "Overdue 2d". */
export function formatDueCountdown(nextDueIso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueIso + "T00:00:00");
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff > 0) return `Due in ${diff}d`;
  return `Overdue ${Math.abs(diff)}d`;
}

/* =========================================================
 * Row + helpers
 * ========================================================= */

export interface ServiceScheduleRow {
  id: string;
  name: string;
  description: string | null;
  service_agreement_id: string | null;
  vendor_id: string;
  target_entity_type: "unit" | "building";
  target_entity_id: string;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  next_due_date: string;
  last_triggered_at: string | null;
  last_triggered_ticket_id: string | null;
  lead_time_days: number;
  status: ScheduleStatus;
  paused_at: string | null;
  paused_reason: string | null;
  ended_at: string | null;
  default_ticket_type: string;
  default_priority: "low" | "medium" | "high" | "urgent";
  auto_assign_vendor: boolean;
  auto_init_workflow: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function frequencyEveryPhrase(f: Frequency): string {
  switch (f) {
    case "weekly":
      return "Every week";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Every month";
    case "quarterly":
      return "Every 3 months";
    case "semi_annually":
      return "Every 6 months";
    case "annually":
      return "Every year";
  }
}