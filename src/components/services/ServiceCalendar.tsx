import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  List as ListIcon,
  Filter as FilterIcon,
  Loader2,
  Plus,
} from "lucide-react";
import { format, isSameDay, isSameMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { CalendarDayPopover } from "./CalendarDayPopover";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  type ServiceCategory,
  type ServiceRequestPriority,
  type ServiceRequestStatus,
} from "@/lib/services";
import {
  groupByDay,
  isoDate,
  isOverdue,
  monthGrid,
  shiftAnchor,
  statusDotClass,
  visibleWindow,
  weekGrid,
  type CalendarItem,
  type CalendarView,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

export type ServiceCalendarScope = { type: "all" } | { type: "unit"; unitId: string };

interface Props {
  scope: ServiceCalendarScope;
  defaultView?: CalendarView;
  showFilters?: boolean;
  showLeaseOverlay?: boolean;
}

const STATUSES: ServiceRequestStatus[] = [
  "open",
  "scheduled",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

const PRIORITIES: ServiceRequestPriority[] = ["urgent", "high", "normal", "low"];

const ASSIGNEE_OPTIONS = [
  { key: "vendor", label: "Vendor" },
  { key: "staff", label: "Staff" },
  { key: "unassigned", label: "Unassigned" },
] as const;

type AssigneeFilter = (typeof ASSIGNEE_OPTIONS)[number]["key"];

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ServiceCalendar({
  scope,
  defaultView = "month",
  showFilters = false,
  showLeaseOverlay = false,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<CalendarView>(defaultView);
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [overlayOn, setOverlayOn] = useState(false);

  // Filters (URL-persisted on the operator view)
  const [statusF, setStatusF] = useState<Set<ServiceRequestStatus>>(
    () => parseSet(searchParams.get("status"), STATUSES),
  );
  const [priorityF, setPriorityF] = useState<Set<ServiceRequestPriority>>(
    () => parseSet(searchParams.get("priority"), PRIORITIES),
  );
  const [assigneeF, setAssigneeF] = useState<Set<AssigneeFilter>>(
    () => parseSet(searchParams.get("assignee"), ASSIGNEE_OPTIONS.map((o) => o.key)),
  );
  const [categoryF, setCategoryF] = useState<Set<ServiceCategory>>(
    () => parseSet(searchParams.get("category"), Object.keys(CATEGORY_LABEL) as ServiceCategory[]),
  );

  // Persist filters in URL (operator view only)
  useEffect(() => {
    if (!showFilters) return;
    const next = new URLSearchParams(searchParams);
    syncSet(next, "status", statusF);
    syncSet(next, "priority", priorityF);
    syncSet(next, "assignee", assigneeF);
    syncSet(next, "category", categoryF);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusF, priorityF, assigneeF, categoryF, showFilters]);

  const win = useMemo(() => visibleWindow(view, anchor), [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    const startISO = isoDate(win.start);
    const endISO = isoDate(win.end);

    // 1) Atomic requests with scheduled_date in window
    let reqQuery = supabase
      .from("service_requests")
      .select(
        "id,request_number,title,status,priority,category,is_workflow,scheduled_date,assigned_vendor_id,assigned_person_id,target_type,target_id",
      )
      .gte("scheduled_date", startISO)
      .lte("scheduled_date", endISO);

    if (scope.type === "unit") {
      reqQuery = reqQuery.eq("target_type", "unit").eq("target_id", scope.unitId);
    }

    // 2) Steps in the window — must filter their parent request to the unit if scoped
    let stepQuery = supabase
      .from("service_request_steps")
      .select(
        "id,request_id,title,status,scheduled_date,category,assigned_vendor_id,assigned_person_id," +
          "service_requests!inner(id,request_number,priority,target_type,target_id,title)",
      )
      .gte("scheduled_date", startISO)
      .lte("scheduled_date", endISO);

    if (scope.type === "unit") {
      stepQuery = stepQuery
        .eq("service_requests.target_type", "unit")
        .eq("service_requests.target_id", scope.unitId);
    }

    const [reqRes, stepRes] = await Promise.all([reqQuery, stepQuery]);

    const out: CalendarItem[] = [];

    // Atomic requests (skip workflow parents — those are represented by their steps)
    for (const r of (reqRes.data ?? []) as any[]) {
      if (r.is_workflow) continue;
      if (!r.scheduled_date) continue;
      out.push({
        key: `req:${r.id}`,
        kind: "request",
        date: r.scheduled_date,
        requestId: r.id,
        requestNumber: r.request_number,
        title: r.title,
        status: r.status,
        unitId: r.target_type === "unit" ? r.target_id : null,
        assignee: assigneeBucket(r.assigned_vendor_id, r.assigned_person_id),
        priority: r.priority,
        category: r.category,
      });
    }

    // Steps
    for (const s of (stepRes.data ?? []) as any[]) {
      if (!s.scheduled_date) continue;
      const parent = s.service_requests;
      out.push({
        key: `step:${s.id}`,
        kind: "step",
        date: s.scheduled_date,
        requestId: s.request_id,
        requestNumber: parent?.request_number ?? "—",
        title: s.title,
        sublabel: parent?.title ?? null,
        status: s.status,
        unitId: parent?.target_type === "unit" ? parent.target_id : null,
        assignee: assigneeBucket(s.assigned_vendor_id, s.assigned_person_id),
        priority: parent?.priority,
        category: s.category,
      });
    }

    // 3) Optional lease milestones overlay (unit scope only)
    if (scope.type === "unit" && showLeaseOverlay && overlayOn) {
      // Find the lease(s) for this unit, then pull cheque schedule.
      const { data: leases } = await supabase
        .from("leases")
        .select("contract_id,unit_id,contracts!inner(id,contract_number,start_date,end_date)")
        .eq("unit_id", scope.unitId);
      const contractIds = (leases ?? []).map((l: any) => l.contract_id);

      // Lease boundary events
      for (const l of (leases ?? []) as any[]) {
        const c = l.contracts;
        if (c?.start_date && c.start_date >= startISO && c.start_date <= endISO) {
          out.push({
            key: `lease-start:${c.id}`,
            kind: "lease_event",
            date: c.start_date,
            requestId: null,
            requestNumber: c.contract_number,
            title: "Lease starts",
            status: "lease",
            unitId: scope.unitId,
          });
        }
        if (c?.end_date && c.end_date >= startISO && c.end_date <= endISO) {
          out.push({
            key: `lease-end:${c.id}`,
            kind: "lease_event",
            date: c.end_date,
            requestId: null,
            requestNumber: c.contract_number,
            title: "Lease ends",
            status: "lease",
            unitId: scope.unitId,
          });
        }
      }

      if (contractIds.length > 0) {
        const { data: sched } = await supabase
          .from("recurring_invoice_schedules")
          .select("id,due_date,installment_number,total_installments,amount,lease_contract_id")
          .in("lease_contract_id", contractIds)
          .gte("due_date", startISO)
          .lte("due_date", endISO);
        for (const r of (sched ?? []) as any[]) {
          out.push({
            key: `chq:${r.id}`,
            kind: "lease_event",
            date: r.due_date,
            requestId: null,
            requestNumber: "RENT",
            title: `Rent due (${r.installment_number}/${r.total_installments})`,
            status: "lease",
            unitId: scope.unitId,
          });
        }
      }
    }

    setItems(out);
    setLoading(false);
  }, [win.start, win.end, scope, showLeaseOverlay, overlayOn]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (it.kind === "lease_event") return true; // overlay is opt-in already
      // status filter applies to atomic requests using request status; for steps, map step status to request status loosely
      if (statusF.size && statusF.size < STATUSES.length) {
        const s = it.status as string;
        // Map step "pending" to "open" for the filter UI
        const mapped = s === "pending" ? "open" : s;
        if (!statusF.has(mapped as ServiceRequestStatus)) return false;
      }
      if (priorityF.size && priorityF.size < PRIORITIES.length) {
        if (!it.priority || !priorityF.has(it.priority as ServiceRequestPriority)) return false;
      }
      if (assigneeF.size && assigneeF.size < ASSIGNEE_OPTIONS.length) {
        const bucket = (it.assignee as AssigneeFilter | null) ?? "unassigned";
        if (!assigneeF.has(bucket)) return false;
      }
      if (categoryF.size && categoryF.size < Object.keys(CATEGORY_LABEL).length) {
        if (!it.category || !categoryF.has(it.category as ServiceCategory)) return false;
      }
      return true;
    });
  }, [items, statusF, priorityF, assigneeF, categoryF]);

  const byDay = useMemo(() => groupByDay(filtered), [filtered]);

  // Summary strip
  const summary = useMemo(() => {
    const today = new Date();
    const week = weekGrid(today).map(isoDate);
    let inWeek = 0;
    let overdue = 0;
    let approval = 0;
    for (const it of items) {
      if (week.includes(it.date)) inWeek++;
      if (isOverdue(it)) overdue++;
      if (it.status === "blocked") approval++; // proxy; explicit approval gating lives on requests page
    }
    return { inWeek, overdue, approval };
  }, [items]);

  const headerLabel = useMemo(() => {
    if (view === "month") return format(anchor, "MMMM yyyy");
    if (view === "week") {
      const days = weekGrid(anchor);
      return `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`;
    }
    return `${format(win.start, "MMM d")} – ${format(win.end, "MMM d, yyyy")}`;
  }, [view, anchor, win.start, win.end]);

  return (
    <div className="space-y-4">
      {/* Header / controls */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor((d) => shiftAnchor(view, d, -1))} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor((d) => shiftAnchor(view, d, 1))} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="font-display text-xl text-architect ml-2">{headerLabel}</h2>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
        </div>
        <div className="flex items-center gap-2">
          {showLeaseOverlay && scope.type === "unit" && (
            <button
              type="button"
              onClick={() => setOverlayOn((v) => !v)}
              className={cn(
                "text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-sm border hairline transition-colors",
                overlayOn ? "bg-gold/15 text-gold border-gold/40" : "text-muted-foreground hover:text-architect",
              )}
            >
              Lease milestones
            </button>
          )}
          <div className="flex items-center border hairline rounded-sm overflow-hidden">
            {(["month", "week", "list"] as CalendarView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-colors",
                  view === v ? "bg-architect text-chalk" : "text-muted-foreground hover:text-architect hover:bg-muted/40",
                )}
              >
                {v === "month" && <CalendarDays className="h-3.5 w-3.5" />}
                {v === "week" && <CalendarRange className="h-3.5 w-3.5" />}
                {v === "list" && <ListIcon className="h-3.5 w-3.5" />}
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground border hairline rounded-sm bg-muted/20 px-4 py-2">
        <span>
          <strong className="text-architect">{summary.inWeek}</strong> scheduled this week
        </span>
        <span>
          <strong className={summary.overdue > 0 ? "text-destructive" : "text-architect"}>{summary.overdue}</strong> overdue
        </span>
        {scope.type === "all" && (
          <span>
            <strong className="text-architect">{filtered.length}</strong> in view
          </span>
        )}
        {scope.type === "unit" && (
          <span>
            Open jobs: <strong className="text-architect">{items.filter((i) => i.kind !== "lease_event" && !["completed", "cancelled", "skipped"].includes(i.status)).length}</strong>
          </span>
        )}
      </div>

      <div className={cn("grid gap-4", showFilters ? "lg:grid-cols-[1fr_220px]" : "grid-cols-1")}>
        <div className="min-w-0">
          {view === "month" && <MonthView anchor={anchor} byDay={byDay} />}
          {view === "week" && <WeekView anchor={anchor} byDay={byDay} />}
          {view === "list" && <ListView win={win} byDay={byDay} />}
        </div>
        {showFilters && (
          <FilterRail
            statusF={statusF}
            setStatusF={setStatusF}
            priorityF={priorityF}
            setPriorityF={setPriorityF}
            assigneeF={assigneeF}
            setAssigneeF={setAssigneeF}
            categoryF={categoryF}
            setCategoryF={setCategoryF}
          />
        )}
      </div>
    </div>
  );
}

// ---------------- Month view ----------------

function MonthView({ anchor, byDay }: { anchor: Date; byDay: Map<string, CalendarItem[]> }) {
  const days = useMemo(() => monthGrid(anchor), [anchor]);
  const today = new Date();

  return (
    <div className="border hairline rounded-sm bg-card overflow-hidden">
      {/* Desktop / tablet grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 border-b hairline">
          {WEEK_LABELS.map((d) => (
            <div key={d} className="px-2 py-1.5 label-eyebrow text-center border-r hairline last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 grid-rows-6">
          {days.map((day, idx) => {
            const key = isoDate(day);
            const dayItems = byDay.get(key) ?? [];
            const inMonth = isSameMonth(day, anchor);
            const isToday = isSameDay(day, today);
            const visible = dayItems.slice(0, 3);
            const overflow = dayItems.length - visible.length;
            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[110px] border-r border-b hairline last:border-r-0 p-1.5 flex flex-col gap-1",
                  !inMonth && "bg-muted/20",
                  (idx + 1) % 7 === 0 && "border-r-0",
                  idx >= 35 && "border-b-0",
                )}
              >
                <div className="flex items-center justify-between">
                  <Link
                    to={`/services/requests/new?scheduled_date=${key}`}
                    className={cn(
                      "text-[11px] mono px-1 rounded-sm hover:bg-muted/60 transition-colors",
                      inMonth ? "text-architect" : "text-muted-foreground",
                      isToday && "bg-architect text-chalk hover:bg-architect/90 hover:text-chalk",
                    )}
                    title="Schedule on this day"
                  >
                    {format(day, "d")}
                  </Link>
                </div>
                {visible.map((it) => (
                  <ChipLink key={it.key} it={it} />
                ))}
                {overflow > 0 && (
                  <CalendarDayPopover
                    date={key}
                    items={dayItems}
                    trigger={
                      <button
                        type="button"
                        className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-architect text-left px-1"
                      >
                        +{overflow} more
                      </button>
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: agenda list of in-month days that have items */}
      <div className="md:hidden divide-y hairline">
        {days
          .filter((d) => isSameMonth(d, anchor))
          .map((d) => {
            const k = isoDate(d);
            const arr = byDay.get(k) ?? [];
            if (arr.length === 0) return null;
            return (
              <div key={k} className="p-3">
                <div className="label-eyebrow mb-2">{format(d, "EEE, MMM d")}</div>
                <div className="space-y-1">
                  {arr.map((it) => (
                    <ChipLink key={it.key} it={it} expanded />
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ---------------- Week view ----------------

function WeekView({ anchor, byDay }: { anchor: Date; byDay: Map<string, CalendarItem[]> }) {
  const days = useMemo(() => weekGrid(anchor), [anchor]);
  const today = new Date();
  return (
    <div className="border hairline rounded-sm bg-card overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-7">
        {days.map((day, idx) => {
          const key = isoDate(day);
          const arr = byDay.get(key) ?? [];
          const isToday = isSameDay(day, today);
          return (
            <div
              key={idx}
              className={cn(
                "min-h-[260px] border-b md:border-b-0 md:border-r hairline last:border-r-0 last:border-b-0 p-2 flex flex-col gap-1.5",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="label-eyebrow">{format(day, "EEE")}</div>
                <Link
                  to={`/services/requests/new?scheduled_date=${key}`}
                  className={cn(
                    "text-[11px] mono px-1.5 py-0.5 rounded-sm hover:bg-muted/60 transition-colors",
                    isToday ? "bg-architect text-chalk hover:bg-architect/90 hover:text-chalk" : "text-architect",
                  )}
                >
                  {format(day, "d")}
                </Link>
              </div>
              {arr.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic">—</div>
              ) : (
                arr.map((it) => <ChipLink key={it.key} it={it} expanded />)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- List view ----------------

function ListView({
  win,
  byDay,
}: {
  win: { start: Date; end: Date };
  byDay: Map<string, CalendarItem[]>;
}) {
  const days: Date[] = useMemo(() => {
    const out: Date[] = [];
    let d = win.start;
    while (d <= win.end) {
      out.push(d);
      d = new Date(d.getTime() + 86400000);
    }
    return out;
  }, [win.start, win.end]);

  const populated = days.filter((d) => (byDay.get(isoDate(d)) ?? []).length > 0);

  if (populated.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-10 w-10" strokeWidth={1.2} />}
        title="Nothing scheduled in this range"
        description="Use the navigation above to look at another window, or schedule a service from a unit."
      />
    );
  }

  return (
    <div className="border hairline rounded-sm bg-card overflow-hidden divide-y hairline">
      {populated.map((d) => {
        const k = isoDate(d);
        const arr = byDay.get(k)!;
        return (
          <div key={k} className="px-4 py-3">
            <div className="flex items-baseline justify-between mb-2">
              <div className="label-eyebrow">{format(d, "EEE, MMM d, yyyy")}</div>
              <div className="text-[11px] text-muted-foreground">{arr.length} item{arr.length === 1 ? "" : "s"}</div>
            </div>
            <div className="space-y-1">
              {arr.map((it) => (
                <ChipLink key={it.key} it={it} expanded />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Chip ----------------

function ChipLink({ it, expanded = false }: { it: CalendarItem; expanded?: boolean }) {
  const overdue = isOverdue(it);
  const inner = (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm border text-[11px] truncate transition-colors",
        "border-warm-stone/60 bg-card hover:bg-muted/40",
        overdue && "border-destructive/50",
        expanded && "py-1",
      )}
      title={`${it.requestNumber} · ${it.title}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDotClass(it.status))} />
      <span className="mono text-[10px] text-muted-foreground shrink-0">{it.requestNumber}</span>
      <span className="truncate text-architect">{it.title}</span>
    </div>
  );
  if (!it.requestId) return inner;
  return (
    <Link to={`/services/requests/${it.requestId}`} className="block min-w-0">
      {inner}
    </Link>
  );
}

// ---------------- Filter rail ----------------

function FilterRail({
  statusF,
  setStatusF,
  priorityF,
  setPriorityF,
  assigneeF,
  setAssigneeF,
  categoryF,
  setCategoryF,
}: {
  statusF: Set<ServiceRequestStatus>;
  setStatusF: (s: Set<ServiceRequestStatus>) => void;
  priorityF: Set<ServiceRequestPriority>;
  setPriorityF: (s: Set<ServiceRequestPriority>) => void;
  assigneeF: Set<AssigneeFilter>;
  setAssigneeF: (s: Set<AssigneeFilter>) => void;
  categoryF: Set<ServiceCategory>;
  setCategoryF: (s: Set<ServiceCategory>) => void;
}) {
  return (
    <aside className="border hairline rounded-sm bg-card p-3 space-y-4 h-fit lg:sticky lg:top-4">
      <div className="flex items-center gap-1.5 text-xs text-architect">
        <FilterIcon className="h-3.5 w-3.5" />
        <span className="label-eyebrow">Filters</span>
      </div>

      <FilterGroup
        label="Status"
        options={STATUSES.map((s) => ({ key: s, label: REQUEST_STATUS_LABEL[s] }))}
        value={statusF}
        onChange={(v) => setStatusF(v as Set<ServiceRequestStatus>)}
      />
      <FilterGroup
        label="Priority"
        options={PRIORITIES.map((p) => ({ key: p, label: PRIORITY_LABEL[p] }))}
        value={priorityF}
        onChange={(v) => setPriorityF(v as Set<ServiceRequestPriority>)}
      />
      <FilterGroup
        label="Assignee"
        options={ASSIGNEE_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
        value={assigneeF}
        onChange={(v) => setAssigneeF(v as Set<AssigneeFilter>)}
      />
      <FilterGroup
        label="Category"
        options={(Object.keys(CATEGORY_LABEL) as ServiceCategory[]).map((c) => ({
          key: c,
          label: CATEGORY_LABEL[c],
        }))}
        value={categoryF}
        onChange={(v) => setCategoryF(v as Set<ServiceCategory>)}
      />
    </aside>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: Set<T>;
  onChange: (s: Set<T>) => void;
}) {
  const allSelected = value.size === 0 || value.size === options.length;
  const toggle = (k: T) => {
    const next = new Set(allSelected ? [] : value);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="label-eyebrow">{label}</div>
        {!allSelected && (
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-architect"
          >
            Reset
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const active = allSelected || value.has(o.key);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o.key)}
              className={cn(
                "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border hairline transition-colors",
                active
                  ? "bg-architect text-chalk border-architect"
                  : "text-muted-foreground hover:text-architect hover:bg-muted/40",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- helpers ----------------

function assigneeBucket(vendorId: string | null, personId: string | null): AssigneeFilter {
  if (vendorId) return "vendor";
  if (personId) return "staff";
  return "unassigned";
}

function parseSet<T extends string>(raw: string | null, all: readonly T[]): Set<T> {
  if (!raw) return new Set();
  const allowed = new Set(all);
  const parts = raw.split(",").filter((p) => allowed.has(p as T)) as T[];
  if (parts.length === 0 || parts.length === all.length) return new Set();
  return new Set(parts);
}

function syncSet(params: URLSearchParams, key: string, set: Set<string>) {
  if (set.size === 0) {
    params.delete(key);
  } else {
    params.set(key, Array.from(set).join(","));
  }
}