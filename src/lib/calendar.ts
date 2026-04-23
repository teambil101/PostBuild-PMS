import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import type { ServiceRequestStatus, ServiceRequestStepStatus } from "@/lib/services";

export type CalendarView = "month" | "week" | "list";

/** Anything renderable as a chip on the calendar. */
export interface CalendarItem {
  /** Stable identifier (request id or step id, prefixed). */
  key: string;
  /** Source kind. */
  kind: "request" | "step" | "lease_event";
  /** Local date (YYYY-MM-DD) the chip belongs to. */
  date: string;
  /** Owning service request id (for navigation). null for lease events. */
  requestId: string | null;
  /** Owning request number, e.g. SRQ-2026-0001. */
  requestNumber: string;
  /** Display title (step title for steps, request title for atomic). */
  title: string;
  /** Status used for the colored dot. Lease events use a synthetic key. */
  status: ServiceRequestStatus | ServiceRequestStepStatus | "lease";
  /** Optional sub-label (e.g. unit ref). */
  sublabel?: string | null;
  /** Linked unit id, when known. */
  unitId?: string | null;
  /** Assignee summary, when known. */
  assignee?: string | null;
  /** Priority for filtering. */
  priority?: string | null;
  /** Category for filtering. */
  category?: string | null;
}

// ---------------- Grid builders ----------------

/** 6-row × 7-column grid covering the visible month, starting on Monday. */
export function monthGrid(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = start;
  while (d <= end) {
    days.push(d);
    d = addDays(d, 1);
  }
  // Always pad to 42 cells so the grid is uniform.
  while (days.length < 42) days.push(addDays(days[days.length - 1], 1));
  return days;
}

/** Mon→Sun week containing the anchor. */
export function weekGrid(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Visible window for fetching, given a view + anchor. */
export function visibleWindow(view: CalendarView, anchor: Date): { start: Date; end: Date } {
  if (view === "month") {
    const days = monthGrid(anchor);
    return { start: startOfDay(days[0]), end: startOfDay(days[days.length - 1]) };
  }
  if (view === "week") {
    const days = weekGrid(anchor);
    return { start: startOfDay(days[0]), end: startOfDay(days[6]) };
  }
  // List view: 60 days centered on anchor.
  return {
    start: startOfDay(addDays(anchor, -7)),
    end: startOfDay(addDays(anchor, 53)),
  };
}

export function shiftAnchor(view: CalendarView, anchor: Date, dir: -1 | 1): Date {
  if (view === "month") return dir < 0 ? subMonths(anchor, 1) : addMonths(anchor, 1);
  if (view === "week") return addDays(anchor, dir * 7);
  return addDays(anchor, dir * 30);
}

export function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function groupByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const arr = map.get(it.date);
    if (arr) arr.push(it);
    else map.set(it.date, [it]);
  }
  // Sort within each day: status first (open > scheduled > in_progress > others), then title.
  const order: Record<string, number> = {
    open: 0,
    pending: 0,
    scheduled: 1,
    in_progress: 2,
    blocked: 3,
    completed: 4,
    cancelled: 5,
    skipped: 5,
    lease: 6,
  };
  for (const arr of map.values()) {
    arr.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.title.localeCompare(b.title));
  }
  return map;
}

/** Tailwind class for the small status dot on a chip. */
export function statusDotClass(status: CalendarItem["status"]): string {
  switch (status) {
    case "open":
    case "pending":
      return "bg-muted-foreground";
    case "scheduled":
      return "bg-blue-500";
    case "in_progress":
      return "bg-amber-500";
    case "blocked":
      return "bg-destructive";
    case "completed":
      return "bg-status-occupied";
    case "cancelled":
    case "skipped":
      return "bg-warm-stone";
    case "lease":
      return "bg-gold";
    default:
      return "bg-muted-foreground";
  }
}

/** Past-dated and not in a terminal state? */
export function isOverdue(item: CalendarItem, today = new Date()): boolean {
  if (item.kind === "lease_event") return false;
  const terminal = ["completed", "cancelled", "skipped"];
  if (terminal.includes(item.status)) return false;
  const d = new Date(item.date + "T00:00:00");
  return d < startOfDay(today) && !isSameDay(d, today);
}

export { format as formatDate };