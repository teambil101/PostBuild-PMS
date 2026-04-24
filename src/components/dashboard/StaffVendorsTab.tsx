import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, MessageSquare, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  loadActivityFeed,
  loadAssigneeRollups,
  loadFinancialsSummary,
  loadPerformanceSummary,
  loadQualitySummary,
  loadServiceRollups,
  type ActivityItem,
  type AssigneeRollup,
  type FinancialsSummary,
  type PerformanceSummary,
  type PeriodKey,
  type QualitySummary,
  type ServiceRollup,
} from "@/lib/performance";
import { PeriodSelector } from "./PeriodSelector";
import { KpiCard } from "./KpiCard";
import { Leaderboard, type LeaderRow } from "./Leaderboard";
import { ActivityFeed } from "./ActivityFeed";

const CCY_DEFAULT = "AED";
const fmtMoney = (n: number) =>
  `${CCY_DEFAULT} ${Math.round(n).toLocaleString("en-US")}`;
const fmtPct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(0)}%`);
const fmtDays = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}d`);
const fmtRating = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}★`);

const VALID: PeriodKey[] = ["30d", "90d", "ytd", "all"];

function isValidPeriod(s: string | null): s is PeriodKey {
  return s != null && (VALID as string[]).includes(s);
}

function topBottom<T>(arr: T[], pickValue: (t: T) => number, n = 5, predicate?: (t: T) => boolean) {
  const filtered = predicate ? arr.filter(predicate) : arr;
  const sorted = [...filtered].sort((a, b) => pickValue(b) - pickValue(a));
  return {
    top: sorted.slice(0, n),
    bottom: [...filtered].sort((a, b) => pickValue(a) - pickValue(b)).slice(0, n),
  };
}

const assigneeHref = (a: AssigneeRollup) =>
  a.kind === "vendor" ? `/vendors/${a.id}` : `/people/${a.id}`;

export function StaffVendorsTab() {
  const [params, setParams] = useSearchParams();
  const initial = isValidPeriod(params.get("period")) ? (params.get("period") as PeriodKey) : "90d";
  const [period, setPeriod] = useState<PeriodKey>(initial);

  const [fin, setFin] = useState<FinancialsSummary | null>(null);
  const [perf, setPerf] = useState<PerformanceSummary | null>(null);
  const [qual, setQual] = useState<QualitySummary | null>(null);
  const [services, setServices] = useState<ServiceRollup[]>([]);
  const [assignees, setAssignees] = useState<AssigneeRollup[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("period", period);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      loadFinancialsSummary(period),
      loadPerformanceSummary(period),
      loadQualitySummary(period),
      loadServiceRollups(period),
      loadAssigneeRollups(period),
    ])
      .then(([f, p, q, s, a]) => {
        if (cancel) return;
        setFin(f);
        setPerf(p);
        setQual(q);
        setServices(s);
        setAssignees(a);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard load error", err);
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [period]);

  useEffect(() => {
    let cancel = false;
    setActivityLoading(true);
    loadActivityFeed().then((a) => {
      if (!cancel) {
        setActivity(a);
        setActivityLoading(false);
      }
    });
    return () => {
      cancel = true;
    };
  }, []);

  // ---- Service leaderboards
  const serviceRev = useMemo(
    () => topBottom(services, (s) => s.revenue, 5, (s) => s.revenue > 0),
    [services],
  );
  const serviceCost = useMemo(
    () => topBottom(services, (s) => s.cost, 5, (s) => s.cost > 0),
    [services],
  );

  // ---- Vendor / staff
  const vendorSpend = useMemo(
    () =>
      topBottom(
        assignees.filter((a) => a.kind === "vendor"),
        (a) => a.cost,
        5,
        (a) => a.cost > 0,
      ),
    [assignees],
  );
  const staffJobs = useMemo(
    () =>
      topBottom(
        assignees.filter((a) => a.kind === "staff"),
        (a) => a.jobCount,
        5,
        (a) => a.jobCount > 0,
      ),
    [assignees],
  );

  // ---- Performance leaderboards (min 3 jobs)
  const MIN_JOBS = 3;
  const fastestStaff = useMemo(() => {
    const eligible = assignees.filter(
      (a) => a.kind === "staff" && a.avgCompletionDays != null && a.jobCount >= MIN_JOBS,
    );
    return [...eligible].sort((a, b) => (a.avgCompletionDays ?? 0) - (b.avgCompletionDays ?? 0)).slice(0, 5);
  }, [assignees]);
  const fastestVendors = useMemo(() => {
    const eligible = assignees.filter(
      (a) => a.kind === "vendor" && a.avgCompletionDays != null && a.jobCount >= MIN_JOBS,
    );
    return [...eligible].sort((a, b) => (a.avgCompletionDays ?? 0) - (b.avgCompletionDays ?? 0)).slice(0, 5);
  }, [assignees]);
  const bestOnTime = useMemo(() => {
    const eligible = assignees.filter((a) => a.onTimeRate != null && a.jobCount >= MIN_JOBS);
    return [...eligible].sort((a, b) => (b.onTimeRate ?? 0) - (a.onTimeRate ?? 0)).slice(0, 5);
  }, [assignees]);
  const worstOnTime = useMemo(() => {
    const eligible = assignees.filter((a) => a.onTimeRate != null && a.jobCount >= MIN_JOBS);
    return [...eligible].sort((a, b) => (a.onTimeRate ?? 0) - (b.onTimeRate ?? 0)).slice(0, 5);
  }, [assignees]);

  // ---- Quality leaderboards (min 3 ratings)
  const MIN_RATINGS = 3;
  const topRatedStaff = useMemo(() => {
    const eligible = assignees.filter(
      (a) => a.kind === "staff" && a.avgRating != null && a.ratingCount >= MIN_RATINGS,
    );
    return [...eligible].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)).slice(0, 5);
  }, [assignees]);
  const topRatedVendors = useMemo(() => {
    const eligible = assignees.filter(
      (a) => a.kind === "vendor" && a.avgRating != null && a.ratingCount >= MIN_RATINGS,
    );
    return [...eligible].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)).slice(0, 5);
  }, [assignees]);
  const lowestRated = useMemo(() => {
    const eligible = assignees.filter(
      (a) => a.avgRating != null && a.ratingCount >= MIN_RATINGS,
    );
    return [...eligible].sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0)).slice(0, 5);
  }, [assignees]);

  if (loading || !fin || !perf || !qual) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted/40 animate-pulse rounded-sm" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted/40 animate-pulse rounded-sm" />
          ))}
        </div>
        <div className="h-64 bg-muted/40 animate-pulse rounded-sm" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-muted-foreground">
          Showing data for the selected window. Money totals exclude voided documents and drafts.
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* ============== SECTION A: VENDOR & STAFF PERFORMANCE (incl. quality) ============== */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl text-architect">Vendor & staff performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Speed, on-time delivery, throughput, budget discipline, and customer-rated quality.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Avg completion time"
            value={fmtDays(perf.avgCompletionDays.value || null)}
            deltaPct={perf.avgCompletionDays.deltaPct}
            invertDelta
            hint="Started → completed"
          />
          <KpiCard
            label="On-time rate"
            value={fmtPct(perf.onTimeRate.value)}
            deltaPct={perf.onTimeRate.deltaPct}
            hint="Completed by scheduled date"
          />
          <KpiCard
            label="Active jobs"
            value={String(perf.activeJobs)}
            hint={`${perf.slaBreaches} past scheduled date`}
            tone={perf.slaBreaches > 0 ? "warning" : "default"}
          />
          <KpiCard
            label="Cost vs estimate"
            value={fmtPct(perf.costVariancePct.value)}
            deltaPct={perf.costVariancePct.deltaPct}
            invertDelta
            hint={
              perf.costVariancePct.value > 0
                ? "Over estimate on average"
                : perf.costVariancePct.value < 0
                ? "Under estimate on average"
                : "On budget"
            }
            tone={perf.costVariancePct.value > 0.15 ? "warning" : "default"}
          />
          <KpiCard
            label="Avg rating"
            value={fmtRating(qual.avgRating.value || null)}
            deltaPct={qual.avgRating.deltaPct}
            hint={qual.feedbackCount.value === 0 ? "No feedback yet" : `${qual.feedbackCount.value} ratings`}
          />
          <KpiCard
            label="Feedback collected"
            value={String(qual.feedbackCount.value)}
            deltaPct={qual.feedbackCount.deltaPct}
          />
          <KpiCard
            label="Feedback coverage"
            value={fmtPct(qual.coverage.value)}
            deltaPct={qual.coverage.deltaPct}
            hint="Of completed jobs"
            tone={qual.coverage.value < 0.3 && qual.feedbackCount.value > 0 ? "warning" : "default"}
          />
          <KpiCard
            label="Awaiting feedback"
            value={String(qual.awaitingFeedback.length)}
            hint="Recent completions, not yet rated"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Leaderboard
            title="Fastest staff"
            description="Lowest average completion time."
            rows={fastestStaff.map<LeaderRow>((a) => ({
              id: a.id,
              name: a.name,
              href: assigneeHref(a),
              primary: fmtDays(a.avgCompletionDays),
              secondary: `${a.jobCount} jobs`,
            }))}
            thresholdNote={`Requires at least ${MIN_JOBS} completed jobs.`}
          />
          <Leaderboard
            title="Fastest vendors"
            description="Lowest average completion time."
            rows={fastestVendors.map<LeaderRow>((a) => ({
              id: a.id,
              name: a.name,
              href: assigneeHref(a),
              primary: fmtDays(a.avgCompletionDays),
              secondary: `${a.jobCount} jobs`,
            }))}
            thresholdNote={`Requires at least ${MIN_JOBS} completed jobs.`}
          />
          <Leaderboard
            title="Best on-time delivery"
            description="Completed by the scheduled date."
            rows={bestOnTime.map<LeaderRow>((a) => ({
              id: a.id,
              name: `${a.name} · ${a.kind === "vendor" ? "Vendor" : "Staff"}`,
              href: assigneeHref(a),
              primary: fmtPct(a.onTimeRate),
              secondary: `${a.jobCount} jobs`,
            }))}
            thresholdNote={`Requires at least ${MIN_JOBS} jobs with a scheduled date.`}
          />
          <Leaderboard
            title="Needs attention"
            description="Worst on-time delivery — coach or replace."
            rows={worstOnTime.map<LeaderRow>((a) => ({
              id: a.id,
              name: `${a.name} · ${a.kind === "vendor" ? "Vendor" : "Staff"}`,
              href: assigneeHref(a),
              primary: fmtPct(a.onTimeRate),
              secondary: `${a.jobCount} jobs`,
              warn: (a.onTimeRate ?? 1) < 0.6,
            }))}
            thresholdNote={`Requires at least ${MIN_JOBS} jobs with a scheduled date.`}
          />
        </div>

        {/* Quality leaderboards / awaiting feedback list */}
        {qual.feedbackCount.value === 0 ? (
          <div className="border hairline rounded-sm bg-muted/20 p-6 text-center">
            <MessageSquare className="h-6 w-6 text-true-taupe mx-auto mb-2" strokeWidth={1.4} />
            <div className="font-display text-base text-architect">No customer feedback yet</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Open any completed service request and use{" "}
              <span className="text-architect">Record customer feedback</span> to capture a 1–5 star
              rating and a comment. Quality KPIs will populate as feedback comes in.
            </p>
            {qual.awaitingFeedback.length > 0 && (
              <div className="mt-4 inline-flex flex-col gap-1.5 text-left">
                {qual.awaitingFeedback.slice(0, 3).map((r) => (
                  <Link
                    key={r.id}
                    to={`/services/requests/${r.id}`}
                    className="text-xs text-architect hover:underline inline-flex items-center gap-1.5"
                  >
                    <ChevronRight className="h-3 w-3" />
                    {r.request_number} · {r.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Leaderboard
              title="Top-rated staff"
              description="Highest average customer rating."
              rows={topRatedStaff.map<LeaderRow>((a) => ({
                id: a.id,
                name: a.name,
                href: assigneeHref(a),
                primary: fmtRating(a.avgRating),
                secondary: `${a.ratingCount} ratings`,
              }))}
              thresholdNote={`Requires at least ${MIN_RATINGS} ratings.`}
            />
            <Leaderboard
              title="Top-rated vendors"
              description="Highest average customer rating."
              rows={topRatedVendors.map<LeaderRow>((a) => ({
                id: a.id,
                name: a.name,
                href: assigneeHref(a),
                primary: fmtRating(a.avgRating),
                secondary: `${a.ratingCount} ratings`,
              }))}
              thresholdNote={`Requires at least ${MIN_RATINGS} ratings.`}
            />
            <Leaderboard
              title="Lowest-rated"
              description="Quality issues — investigate."
              rows={lowestRated.map<LeaderRow>((a) => ({
                id: a.id,
                name: `${a.name} · ${a.kind === "vendor" ? "Vendor" : "Staff"}`,
                href: assigneeHref(a),
                primary: fmtRating(a.avgRating),
                secondary: `${a.ratingCount} ratings`,
                warn: (a.avgRating ?? 5) < 3,
              }))}
              thresholdNote={`Requires at least ${MIN_RATINGS} ratings.`}
            />
            <div className="border hairline rounded-sm bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-700" strokeWidth={1.5} />
                <div className="font-display text-base text-architect">Awaiting feedback</div>
              </div>
              {qual.awaitingFeedback.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic">
                  All recent completed jobs have feedback recorded. Great work.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {qual.awaitingFeedback.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-sm py-1.5 border-b hairline last:border-b-0">
                      <Link
                        to={`/services/requests/${r.id}`}
                        className="flex-1 min-w-0 text-architect hover:underline truncate"
                      >
                        <span className="mono text-[11px] text-muted-foreground mr-1.5">{r.request_number}</span>
                        {r.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ============== SECTION B: FINANCIALS ============== */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl text-architect">Financials</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cost paid to vendors and staff vs. revenue billed to landlords and tenants.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Service cost"
            value={fmtMoney(fin.cost.value)}
            deltaPct={fin.cost.deltaPct}
            invertDelta
            hint="Bills + staff cost"
          />
          <KpiCard
            label="Service revenue"
            value={fmtMoney(fin.revenue.value)}
            deltaPct={fin.revenue.deltaPct}
            hint="Service-linked invoices"
          />
          <KpiCard
            label="Net margin"
            value={fmtMoney(fin.margin.value)}
            deltaPct={fin.margin.deltaPct}
            hint={fin.marginPct != null ? `${(fin.marginPct * 100).toFixed(1)}% of revenue` : undefined}
            tone={fin.margin.value < 0 ? "danger" : "default"}
          />
          <KpiCard
            label="Open vendor liability"
            value={fmtMoney(fin.openVendorLiability)}
            hint="Unpaid bill balances"
            tone={fin.openVendorLiability > 0 ? "warning" : "default"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Leaderboard
            title="Top services by revenue"
            description="Highest gross billed."
            rows={serviceRev.top.map<LeaderRow>((s) => ({
              id: s.catalogId,
              name: s.name,
              primary: fmtMoney(s.revenue),
              secondary: `${s.jobCount} jobs`,
            }))}
          />
          <Leaderboard
            title="Lowest revenue services"
            description="Smallest gross — review pricing."
            rows={serviceRev.bottom.map<LeaderRow>((s) => ({
              id: s.catalogId,
              name: s.name,
              primary: fmtMoney(s.revenue),
              secondary: `${s.jobCount} jobs`,
            }))}
          />
          <Leaderboard
            title="Top services by cost"
            description="Where the money goes."
            rows={serviceCost.top.map<LeaderRow>((s) => ({
              id: s.catalogId,
              name: s.name,
              primary: fmtMoney(s.cost),
              secondary: `${s.jobCount} jobs`,
            }))}
          />
          <Leaderboard
            title="Top vendors by spend"
            description="Largest accounts payable contributors."
            rows={vendorSpend.top.map<LeaderRow>((a) => ({
              id: a.id,
              name: a.name,
              href: assigneeHref(a),
              primary: fmtMoney(a.cost),
              secondary: `${a.jobCount} jobs`,
            }))}
          />
          <Leaderboard
            title="Top staff by jobs"
            description="Highest workload."
            rows={staffJobs.top.map<LeaderRow>((a) => ({
              id: a.id,
              name: a.name,
              href: assigneeHref(a),
              primary: `${a.jobCount} jobs`,
              secondary: a.cost > 0 ? fmtMoney(a.cost) : undefined,
            }))}
          />
        </div>
      </section>

      {/* ============== SECTION D: ACTIVITY ============== */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl text-architect">Recent activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Latest service events, vendor payments, and feedback across the operation.
          </p>
        </div>
        <ActivityFeed items={activity} loading={activityLoading} />
      </section>
    </div>
  );
}
