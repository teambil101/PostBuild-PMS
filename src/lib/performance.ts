import { supabase } from "@/integrations/supabase/client";
import { toNum, round2 } from "@/lib/financialFormulas";

// ============================================================
// Period helpers
// ============================================================
export type PeriodKey = "30d" | "90d" | "ytd" | "all";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  ytd: "Year to date",
  all: "All time",
};

export interface PeriodWindow {
  startISO: string | null; // null = unbounded
  endISO: string;          // exclusive upper bound
  prevStartISO: string | null;
  prevEndISO: string | null;
}

export function periodWindow(key: PeriodKey, now = new Date()): PeriodWindow {
  const end = new Date(now);
  const endISO = end.toISOString();
  if (key === "all") {
    return { startISO: null, endISO, prevStartISO: null, prevEndISO: null };
  }
  let start: Date;
  if (key === "ytd") {
    start = new Date(end.getFullYear(), 0, 1);
  } else {
    const days = key === "30d" ? 30 : 90;
    start = new Date(end);
    start.setDate(end.getDate() - days);
  }
  const startISO = start.toISOString();
  // Equal-length prior window
  const span = end.getTime() - start.getTime();
  const prevEnd = new Date(start);
  const prevStart = new Date(start.getTime() - span);
  return { startISO, endISO, prevStartISO: prevStart.toISOString(), prevEndISO: prevEnd.toISOString() };
}

// ============================================================
// Types
// ============================================================
export interface KpiValue {
  value: number;
  prev: number | null;
  /** delta as a decimal (e.g. 0.12 = +12%). null when no comparison. */
  deltaPct: number | null;
}

export interface FinancialsSummary {
  cost: KpiValue;
  revenue: KpiValue;
  margin: KpiValue;
  marginPct: number | null;
  openVendorLiability: number;
}

export interface ServiceRollup {
  catalogId: string;
  name: string;
  jobCount: number;
  revenue: number;
  cost: number;
  margin: number;
}

export interface AssigneeRollup {
  id: string;
  kind: "staff" | "vendor";
  name: string;
  jobCount: number;
  revenue: number;
  cost: number;
  margin: number;
  // Performance
  avgCompletionDays: number | null;
  onTimeRate: number | null; // 0..1
  costVariancePct: number | null;
  // Quality
  avgRating: number | null;
  ratingCount: number;
}

export interface PerformanceSummary {
  avgCompletionDays: KpiValue;
  onTimeRate: KpiValue; // 0..1
  costVariancePct: KpiValue;
  activeJobs: number;
  slaBreaches: number;
  throughput: KpiValue;
}

export interface QualitySummary {
  avgRating: KpiValue; // 0..5
  feedbackCount: KpiValue;
  coverage: KpiValue; // 0..1 (feedback rows / completed)
  awaitingFeedback: { id: string; request_number: string; title: string; completed_at: string }[];
}

export interface ActivityItem {
  id: string;
  kind: "service_event" | "payment" | "feedback";
  at: string;
  title: string;
  detail: string | null;
  href: string | null;
}

// ============================================================
// Internal helpers
// ============================================================
function delta(curr: number, prev: number | null): number | null {
  if (prev == null) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return (curr - prev) / Math.abs(prev);
}

function applyRange<T>(
  q: any,
  column: string,
  win: { startISO: string | null; endISO: string },
) {
  if (win.startISO) q = q.gte(column, win.startISO);
  q = q.lt(column, win.endISO);
  return q as T;
}

// ============================================================
// Financials
// ============================================================
async function sumBills(win: { startISO: string | null; endISO: string }): Promise<number> {
  let q = supabase.from("bills").select("total, voided_at").neq("status", "draft");
  q = applyRange(q, "issue_date", win);
  const { data } = await q;
  return round2(
    (data ?? [])
      .filter((r: any) => !r.voided_at)
      .reduce((s, r: any) => s + toNum(r.total), 0),
  );
}

async function sumInvoices(win: { startISO: string | null; endISO: string }): Promise<number> {
  let q = supabase
    .from("invoices")
    .select("total, voided_at, service_request_id")
    .neq("status", "draft")
    .not("service_request_id", "is", null);
  q = applyRange(q, "issue_date", win);
  const { data } = await q;
  return round2(
    (data ?? [])
      .filter((r: any) => !r.voided_at)
      .reduce((s, r: any) => s + toNum(r.total), 0),
  );
}

async function openVendorLiability(): Promise<number> {
  const { data } = await supabase
    .from("bills")
    .select("total, amount_paid, voided_at")
    .neq("status", "paid")
    .neq("status", "draft")
    .is("voided_at", null);
  return round2(
    (data ?? []).reduce(
      (s, r: any) => s + Math.max(0, toNum(r.total) - toNum(r.amount_paid)),
      0,
    ),
  );
}

export async function loadFinancialsSummary(period: PeriodKey): Promise<FinancialsSummary> {
  const win = periodWindow(period);
  const prev = win.prevStartISO ? { startISO: win.prevStartISO, endISO: win.prevEndISO! } : null;
  const [cost, revenue, prevCost, prevRevenue, liab] = await Promise.all([
    sumBills(win),
    sumInvoices(win),
    prev ? sumBills(prev) : Promise.resolve(null as number | null),
    prev ? sumInvoices(prev) : Promise.resolve(null as number | null),
    openVendorLiability(),
  ]);
  const margin = round2(revenue - cost);
  const prevMargin = prevCost != null && prevRevenue != null ? round2(prevRevenue - prevCost) : null;
  return {
    cost: { value: cost, prev: prevCost, deltaPct: delta(cost, prevCost) },
    revenue: { value: revenue, prev: prevRevenue, deltaPct: delta(revenue, prevRevenue) },
    margin: { value: margin, prev: prevMargin, deltaPct: delta(margin, prevMargin) },
    marginPct: revenue > 0 ? margin / revenue : null,
    openVendorLiability: liab,
  };
}

// ============================================================
// Service-level rollups
// ============================================================
export async function loadServiceRollups(period: PeriodKey): Promise<ServiceRollup[]> {
  const win = periodWindow(period);
  // Fetch service requests in window with catalog info
  let rq = supabase
    .from("service_requests")
    .select("id, catalog_id, title, cost_final, cost_estimate")
    .not("catalog_id", "is", null);
  rq = applyRange(rq, "created_at", win);
  const { data: requests } = await rq;
  const reqRows = (requests ?? []) as any[];
  if (reqRows.length === 0) return [];
  const reqIds = reqRows.map((r) => r.id);

  // Catalog names
  const catalogIds = Array.from(new Set(reqRows.map((r) => r.catalog_id).filter(Boolean)));
  const { data: catalogRows } = await supabase
    .from("service_catalog")
    .select("id, name")
    .in("id", catalogIds);
  const catalogName = new Map<string, string>();
  (catalogRows ?? []).forEach((c: any) => catalogName.set(c.id, c.name));

  // Sum invoices and bills by service_request_id
  const [invRes, billRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("service_request_id, total, voided_at, status")
      .in("service_request_id", reqIds)
      .neq("status", "draft"),
    supabase
      .from("bills")
      .select("service_request_id, total, voided_at, status")
      .in("service_request_id", reqIds)
      .neq("status", "draft"),
  ]);

  const revByReq = new Map<string, number>();
  (invRes.data ?? []).forEach((r: any) => {
    if (r.voided_at) return;
    revByReq.set(r.service_request_id, (revByReq.get(r.service_request_id) ?? 0) + toNum(r.total));
  });
  const costByReq = new Map<string, number>();
  (billRes.data ?? []).forEach((r: any) => {
    if (r.voided_at) return;
    costByReq.set(r.service_request_id, (costByReq.get(r.service_request_id) ?? 0) + toNum(r.total));
  });

  const byCatalog = new Map<string, ServiceRollup>();
  for (const r of reqRows) {
    const cid = r.catalog_id as string;
    if (!cid) continue;
    let entry = byCatalog.get(cid);
    if (!entry) {
      entry = {
        catalogId: cid,
        name: catalogName.get(cid) ?? "Unknown service",
        jobCount: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
      };
      byCatalog.set(cid, entry);
    }
    entry.jobCount += 1;
    entry.revenue += revByReq.get(r.id) ?? 0;
    // Fall back to cost_final on request if no bill is recorded (covers staff-delivered work)
    entry.cost += costByReq.get(r.id) ?? toNum(r.cost_final);
  }
  for (const e of byCatalog.values()) {
    e.revenue = round2(e.revenue);
    e.cost = round2(e.cost);
    e.margin = round2(e.revenue - e.cost);
  }
  return Array.from(byCatalog.values());
}

// ============================================================
// Assignee rollups (staff + vendors)
// ============================================================
export async function loadAssigneeRollups(period: PeriodKey): Promise<AssigneeRollup[]> {
  const win = periodWindow(period);
  let rq = supabase
    .from("service_requests")
    .select(
      "id, assigned_person_id, assigned_vendor_id, cost_final, cost_estimate, started_at, completed_at, scheduled_date, status, created_at",
    );
  rq = applyRange(rq, "created_at", win);
  const { data: requests } = await rq;
  const reqRows = ((requests ?? []) as any[]).filter(
    (r) => r.assigned_person_id || r.assigned_vendor_id,
  );
  if (reqRows.length === 0) return [];

  const reqIds = reqRows.map((r) => r.id);

  // Resolve names
  const personIds = Array.from(new Set(reqRows.map((r) => r.assigned_person_id).filter(Boolean)));
  const vendorIds = Array.from(new Set(reqRows.map((r) => r.assigned_vendor_id).filter(Boolean)));
  const [personRes, vendorRes, invRes, billRes, fbRes] = await Promise.all([
    personIds.length
      ? supabase.from("people").select("id, first_name, last_name").in("id", personIds)
      : Promise.resolve({ data: [] as any[] }),
    vendorIds.length
      ? supabase.from("vendors").select("id, legal_name, display_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("invoices")
      .select("service_request_id, total, voided_at, status")
      .in("service_request_id", reqIds)
      .neq("status", "draft"),
    supabase
      .from("bills")
      .select("service_request_id, total, voided_at, status")
      .in("service_request_id", reqIds)
      .neq("status", "draft"),
    supabase
      .from("service_feedback")
      .select("service_request_id, rating")
      .in("service_request_id", reqIds),
  ]);

  const personName = new Map<string, string>();
  (personRes.data ?? []).forEach((p: any) =>
    personName.set(p.id, `${p.first_name} ${p.last_name}`.trim()),
  );
  const vendorName = new Map<string, string>();
  (vendorRes.data ?? []).forEach((v: any) =>
    vendorName.set(v.id, v.display_name || v.legal_name),
  );

  const revByReq = new Map<string, number>();
  (invRes.data ?? []).forEach((r: any) => {
    if (r.voided_at) return;
    revByReq.set(r.service_request_id, (revByReq.get(r.service_request_id) ?? 0) + toNum(r.total));
  });
  const costByReq = new Map<string, number>();
  (billRes.data ?? []).forEach((r: any) => {
    if (r.voided_at) return;
    costByReq.set(r.service_request_id, (costByReq.get(r.service_request_id) ?? 0) + toNum(r.total));
  });
  const fbByReq = new Map<string, number>();
  (fbRes.data ?? []).forEach((f: any) => fbByReq.set(f.service_request_id, f.rating));

  const map = new Map<string, AssigneeRollup>();
  const ensure = (id: string, kind: "staff" | "vendor", name: string) => {
    const key = `${kind}:${id}`;
    let e = map.get(key);
    if (!e) {
      e = {
        id,
        kind,
        name,
        jobCount: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        avgCompletionDays: null,
        onTimeRate: null,
        costVariancePct: null,
        avgRating: null,
        ratingCount: 0,
      };
      map.set(key, e);
    }
    return e;
  };

  // Track raw arrays for averaging
  const completionDays = new Map<string, number[]>();
  const onTimeBuckets = new Map<string, { onTime: number; total: number }>();
  const variances = new Map<string, number[]>();
  const ratings = new Map<string, number[]>();

  for (const r of reqRows) {
    const targets: { key: string; entry: AssigneeRollup }[] = [];
    if (r.assigned_person_id) {
      const e = ensure(r.assigned_person_id, "staff", personName.get(r.assigned_person_id) ?? "Unknown");
      targets.push({ key: `staff:${r.assigned_person_id}`, entry: e });
    }
    if (r.assigned_vendor_id) {
      const e = ensure(r.assigned_vendor_id, "vendor", vendorName.get(r.assigned_vendor_id) ?? "Unknown");
      targets.push({ key: `vendor:${r.assigned_vendor_id}`, entry: e });
    }
    const rev = revByReq.get(r.id) ?? 0;
    const cost = costByReq.get(r.id) ?? toNum(r.cost_final);

    for (const { key, entry } of targets) {
      entry.jobCount += 1;
      entry.revenue += rev;
      entry.cost += cost;

      if (r.started_at && r.completed_at) {
        const days =
          (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 86_400_000;
        if (days >= 0) {
          const arr = completionDays.get(key) ?? [];
          arr.push(days);
          completionDays.set(key, arr);
        }
      }
      if (r.completed_at && r.scheduled_date) {
        const completed = new Date(r.completed_at);
        const scheduled = new Date(r.scheduled_date + "T23:59:59");
        const bucket = onTimeBuckets.get(key) ?? { onTime: 0, total: 0 };
        bucket.total += 1;
        if (completed.getTime() <= scheduled.getTime()) bucket.onTime += 1;
        onTimeBuckets.set(key, bucket);
      }
      if (r.cost_estimate != null && r.cost_final != null && toNum(r.cost_estimate) > 0) {
        const v = (toNum(r.cost_final) - toNum(r.cost_estimate)) / toNum(r.cost_estimate);
        const arr = variances.get(key) ?? [];
        arr.push(v);
        variances.set(key, arr);
      }
      const rating = fbByReq.get(r.id);
      if (rating != null) {
        const arr = ratings.get(key) ?? [];
        arr.push(rating);
        ratings.set(key, arr);
      }
    }
  }

  for (const [key, entry] of map) {
    entry.revenue = round2(entry.revenue);
    entry.cost = round2(entry.cost);
    entry.margin = round2(entry.revenue - entry.cost);

    const cd = completionDays.get(key);
    entry.avgCompletionDays = cd && cd.length > 0 ? round2(cd.reduce((a, b) => a + b, 0) / cd.length) : null;

    const ot = onTimeBuckets.get(key);
    entry.onTimeRate = ot && ot.total > 0 ? ot.onTime / ot.total : null;

    const vs = variances.get(key);
    entry.costVariancePct = vs && vs.length > 0 ? vs.reduce((a, b) => a + b, 0) / vs.length : null;

    const rs = ratings.get(key);
    entry.ratingCount = rs?.length ?? 0;
    entry.avgRating = rs && rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  }

  return Array.from(map.values());
}

// ============================================================
// Performance summary
// ============================================================
async function performanceFor(win: { startISO: string | null; endISO: string }) {
  let q = supabase
    .from("service_requests")
    .select("started_at, completed_at, scheduled_date, cost_estimate, cost_final, status");
  q = applyRange(q, "created_at", win);
  const { data } = await q;
  const rows = (data ?? []) as any[];
  const completionDays: number[] = [];
  let onTimeOnTime = 0;
  let onTimeTotal = 0;
  const variances: number[] = [];
  let throughput = 0;
  for (const r of rows) {
    if (r.started_at && r.completed_at) {
      const d = (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 86_400_000;
      if (d >= 0) completionDays.push(d);
    }
    if (r.completed_at && r.scheduled_date) {
      onTimeTotal += 1;
      if (new Date(r.completed_at).getTime() <= new Date(r.scheduled_date + "T23:59:59").getTime()) {
        onTimeOnTime += 1;
      }
    }
    if (r.cost_estimate != null && r.cost_final != null && toNum(r.cost_estimate) > 0) {
      variances.push((toNum(r.cost_final) - toNum(r.cost_estimate)) / toNum(r.cost_estimate));
    }
    if (r.status === "completed") throughput += 1;
  }
  return {
    avgCompletion:
      completionDays.length > 0 ? completionDays.reduce((a, b) => a + b, 0) / completionDays.length : 0,
    onTimeRate: onTimeTotal > 0 ? onTimeOnTime / onTimeTotal : 0,
    costVariance: variances.length > 0 ? variances.reduce((a, b) => a + b, 0) / variances.length : 0,
    throughput,
    hasCompletion: completionDays.length > 0,
    hasOnTime: onTimeTotal > 0,
    hasVariance: variances.length > 0,
  };
}

export async function loadPerformanceSummary(period: PeriodKey): Promise<PerformanceSummary> {
  const win = periodWindow(period);
  const prev = win.prevStartISO ? { startISO: win.prevStartISO, endISO: win.prevEndISO! } : null;
  const todayISO = new Date().toISOString().slice(0, 10);

  const [curr, prv, openRes, slaRes] = await Promise.all([
    performanceFor(win),
    prev ? performanceFor(prev) : Promise.resolve(null),
    supabase
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "scheduled", "in_progress"]),
    supabase
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "scheduled", "in_progress"])
      .lt("scheduled_date", todayISO),
  ]);

  return {
    avgCompletionDays: {
      value: round2(curr.avgCompletion),
      prev: prv?.hasCompletion ? round2(prv.avgCompletion) : null,
      deltaPct: prv?.hasCompletion ? delta(curr.avgCompletion, prv.avgCompletion) : null,
    },
    onTimeRate: {
      value: curr.onTimeRate,
      prev: prv?.hasOnTime ? prv.onTimeRate : null,
      deltaPct: prv?.hasOnTime ? delta(curr.onTimeRate, prv.onTimeRate) : null,
    },
    costVariancePct: {
      value: curr.costVariance,
      prev: prv?.hasVariance ? prv.costVariance : null,
      deltaPct: prv?.hasVariance ? delta(curr.costVariance, prv.costVariance) : null,
    },
    throughput: {
      value: curr.throughput,
      prev: prv ? prv.throughput : null,
      deltaPct: prv ? delta(curr.throughput, prv.throughput) : null,
    },
    activeJobs: openRes.count ?? 0,
    slaBreaches: slaRes.count ?? 0,
  };
}

// ============================================================
// Quality summary
// ============================================================
async function qualityFor(win: { startISO: string | null; endISO: string }) {
  let q = supabase.from("service_feedback").select("rating, submitted_at");
  q = applyRange(q, "submitted_at", win);
  const { data } = await q;
  const rows = (data ?? []) as any[];
  const sum = rows.reduce((a, b) => a + (b.rating ?? 0), 0);
  return {
    avg: rows.length > 0 ? sum / rows.length : 0,
    count: rows.length,
  };
}

async function completedInWindow(win: { startISO: string | null; endISO: string }): Promise<number> {
  let q = supabase
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");
  q = applyRange(q, "completed_at", win);
  const { count } = await q;
  return count ?? 0;
}

export async function loadQualitySummary(period: PeriodKey): Promise<QualitySummary> {
  const win = periodWindow(period);
  const prev = win.prevStartISO ? { startISO: win.prevStartISO, endISO: win.prevEndISO! } : null;
  const todayISO = new Date().toISOString();

  const [curr, prv, completedCount, prevCompleted, awaiting] = await Promise.all([
    qualityFor(win),
    prev ? qualityFor(prev) : Promise.resolve(null),
    completedInWindow(win),
    prev ? completedInWindow(prev) : Promise.resolve(null as number | null),
    (async () => {
      // Completed jobs in last 30 days without feedback yet
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: completed } = await supabase
        .from("service_requests")
        .select("id, request_number, title, completed_at")
        .eq("status", "completed")
        .gte("completed_at", since.toISOString())
        .lt("completed_at", todayISO)
        .order("completed_at", { ascending: false })
        .limit(50);
      const ids = (completed ?? []).map((c: any) => c.id);
      if (ids.length === 0) return [] as QualitySummary["awaitingFeedback"];
      const { data: fb } = await supabase
        .from("service_feedback")
        .select("service_request_id")
        .in("service_request_id", ids);
      const have = new Set((fb ?? []).map((f: any) => f.service_request_id));
      return (completed ?? [])
        .filter((c: any) => !have.has(c.id))
        .slice(0, 5)
        .map((c: any) => ({
          id: c.id,
          request_number: c.request_number,
          title: c.title,
          completed_at: c.completed_at,
        }));
    })(),
  ]);

  const coverage = completedCount > 0 ? curr.count / completedCount : 0;
  const prevCoverage =
    prv && prevCompleted != null && prevCompleted > 0 ? prv.count / prevCompleted : null;

  return {
    avgRating: {
      value: round2(curr.avg),
      prev: prv ? round2(prv.avg) : null,
      deltaPct: prv ? delta(curr.avg, prv.avg) : null,
    },
    feedbackCount: {
      value: curr.count,
      prev: prv ? prv.count : null,
      deltaPct: prv ? delta(curr.count, prv.count) : null,
    },
    coverage: {
      value: coverage,
      prev: prevCoverage,
      deltaPct: prevCoverage != null ? delta(coverage, prevCoverage) : null,
    },
    awaitingFeedback: awaiting,
  };
}

// ============================================================
// Activity feed
// ============================================================
export async function loadActivityFeed(): Promise<ActivityItem[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceISO = since.toISOString();

  const [eventsRes, paymentsRes, feedbackRes] = await Promise.all([
    supabase
      .from("service_request_events")
      .select("id, request_id, event_type, description, created_at")
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("payments")
      .select("id, number, amount, currency, direction, paid_on, party_vendor_id, party_person_id")
      .gte("paid_on", sinceISO.slice(0, 10))
      .order("paid_on", { ascending: false })
      .limit(20),
    supabase
      .from("service_feedback")
      .select("id, service_request_id, rating, comment, submitted_at")
      .gte("submitted_at", sinceISO)
      .order("submitted_at", { ascending: false })
      .limit(20),
  ]);

  const items: ActivityItem[] = [];

  for (const e of eventsRes.data ?? []) {
    items.push({
      id: `evt:${e.id}`,
      kind: "service_event",
      at: e.created_at,
      title: e.description || e.event_type.replace(/_/g, " "),
      detail: null,
      href: `/services/requests/${e.request_id}`,
    });
  }
  for (const p of paymentsRes.data ?? []) {
    const dir = p.direction === "in" ? "Received" : "Paid";
    items.push({
      id: `pay:${p.id}`,
      kind: "payment",
      at: p.paid_on + "T00:00:00Z",
      title: `${dir} ${p.currency} ${Number(p.amount).toLocaleString()}`,
      detail: p.number,
      href: "/financials/payments",
    });
  }
  for (const f of feedbackRes.data ?? []) {
    items.push({
      id: `fb:${f.id}`,
      kind: "feedback",
      at: f.submitted_at,
      title: `Customer feedback: ${f.rating}/5`,
      detail: f.comment ? f.comment.slice(0, 80) : null,
      href: `/services/requests/${f.service_request_id}`,
    });
  }

  return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 15);
}
