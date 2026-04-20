import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Settings as SettingsIcon, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { QueueCard } from "@/components/dashboard/QueueCard";
import { AttentionCard } from "@/components/dashboard/AttentionCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import {
  attentionScoreTone,
  daysUntil,
  formatCompact,
  type ManagementDashboard,
  type OperationsDashboard,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";

type TabKey = "my-work" | "overview";
const STORAGE_KEY = "dashboardTab";

export default function Dashboard() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window === "undefined") return isAdmin ? "overview" : "my-work";
    const stored = localStorage.getItem(STORAGE_KEY) as TabKey | null;
    if (stored === "my-work" || stored === "overview") return stored;
    return isAdmin ? "overview" : "my-work";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        eyebrow={`As of ${today}`}
        title="Dashboard"
        description={
          user?.email
            ? `Welcome back, ${user.email.split("@")[0]}. Here's what needs your attention.`
            : "Here's what needs your attention."
        }
      />

      {/* Tabs */}
      <div className="border-b hairline mb-8 flex items-end gap-1">
        <TabButton active={activeTab === "my-work"} onClick={() => setActiveTab("my-work")}>
          My Work
        </TabButton>
        <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
          Overview
        </TabButton>
      </div>

      {activeTab === "my-work" ? <MyWorkTab /> : <OverviewTab />}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-architect text-architect"
          : "border-transparent text-muted-foreground hover:text-architect",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* My Work tab                                                                */
/* -------------------------------------------------------------------------- */

function MyWorkTab() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const isAdmin = roles.includes("admin");
  const [data, setData] = useState<OperationsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: rpc, error: rpcErr } = await supabase.rpc("get_operations_dashboard");
      if (rpcErr) setError(rpcErr.message);
      else setData(rpc as unknown as OperationsDashboard);
      setLoading(false);
    })();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;

  // Auth-not-linked empty state
  if (!data.has_linked_person) {
    return (
      <EmptyState
        icon={<Users className="h-10 w-10" strokeWidth={1.2} />}
        title="Link your account to a person record"
        description="Your login isn't linked to a person record in the system. The My Work dashboard needs this link to surface your tickets, leads, and cheques. Ask an admin to link your account in Settings → Team Members."
        action={
          isAdmin ? (
            <Button variant="gold" onClick={() => navigate("/settings")}>
              <SettingsIcon className="h-4 w-4 mr-1.5" />
              Open Team Members
            </Button>
          ) : undefined
        }
      />
    );
  }

  const { kpis, queues } = data;

  return (
    <div className="space-y-10">
      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="My Open Tickets"
          value={formatCompact(kpis.my_open_tickets.total)}
          subtitle={
            <>
              <span className={kpis.my_open_tickets.urgent > 0 ? "text-destructive font-medium" : ""}>
                {kpis.my_open_tickets.urgent} urgent
              </span>
              {" · "}
              <span className={kpis.my_open_tickets.overdue > 0 ? "text-destructive font-medium" : ""}>
                {kpis.my_open_tickets.overdue} overdue
              </span>
            </>
          }
          to="/tickets"
        />
        <KpiCard
          label="My Leads"
          value={formatCompact(kpis.my_leads.total)}
          subtitle={
            <span className={kpis.my_leads.stuck > 0 ? "text-amber-700 font-medium" : ""}>
              {kpis.my_leads.stuck} stage-stuck
            </span>
          }
          to="/leads"
        />
        <KpiCard
          label="Awaiting My Response"
          value={formatCompact(kpis.tickets_awaiting_me.total)}
          subtitle={
            <span
              className={
                kpis.tickets_awaiting_me.waiting_over_3_days > 0 ? "text-destructive font-medium" : ""
              }
            >
              {kpis.tickets_awaiting_me.waiting_over_3_days} overdue reply
            </span>
          }
          to="/tickets"
        />
        <KpiCard
          label="Cheques Due This Week"
          value={formatCompact(kpis.cheques_due_this_week.count)}
          subtitle={
            kpis.cheques_due_this_week.count > 0
              ? `Total ${formatCurrency(kpis.cheques_due_this_week.total_amount, kpis.cheques_due_this_week.currency)}`
              : "Nothing due in 7 days"
          }
          to="/lifecycle"
        />
        <KpiCard
          label="Workflow Steps Blocked"
          value={formatCompact(kpis.workflow_steps_blocked)}
          subtitle="Required steps pending in your current stages"
          to="/tickets"
        />
        <KpiCard
          label="Overdue On My Plate"
          value={formatCompact(kpis.overdue_on_my_plate.total)}
          subtitle={`${kpis.overdue_on_my_plate.tickets} tickets · ${kpis.overdue_on_my_plate.leads} leads`}
          tone={kpis.overdue_on_my_plate.total > 0 ? "alert" : "default"}
        />
      </section>

      {/* Queues */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <QueueCard
          title="Urgent Tickets"
          count={queues.urgent_tickets.length}
          viewAllTo="/tickets"
          emptyMessage="No urgent tickets assigned to you."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9">TKT #</TableHead>
                <TableHead className="h-9">Subject</TableHead>
                <TableHead className="h-9">Due</TableHead>
                <TableHead className="h-9">Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.urgent_tickets.map((t) => {
                const days = daysUntil(t.due_date);
                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/tickets/${t.id}`)}
                  >
                    <TableCell className="py-2 mono text-xs">{t.ticket_number}</TableCell>
                    <TableCell className="py-2 text-sm truncate max-w-[260px]">{t.subject}</TableCell>
                    <TableCell className="py-2 text-xs">
                      {t.due_date ? (
                        <span
                          className={
                            days !== null && days < 0
                              ? "text-destructive font-medium"
                              : days !== null && days <= 2
                                ? "text-amber-700"
                                : "text-muted-foreground"
                          }
                        >
                          {days !== null && days < 0 ? `${Math.abs(days)}d late` : t.due_date}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground truncate max-w-[180px]">
                      {t.target_label ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </QueueCard>

        <QueueCard
          title="My Leads — Follow-up"
          count={queues.my_leads_follow_up.length}
          viewAllTo="/leads"
          emptyMessage="No leads needing follow-up."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9">LEAD #</TableHead>
                <TableHead className="h-9">Contact</TableHead>
                <TableHead className="h-9">Stage</TableHead>
                <TableHead className="h-9">Aging</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.my_leads_follow_up.map((l) => (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => navigate(`/leads/${l.id}`)}>
                  <TableCell className="py-2 mono text-xs">{l.lead_number}</TableCell>
                  <TableCell className="py-2 text-sm truncate max-w-[200px]">
                    {l.contact_name ?? "—"}
                    {l.company_name && (
                      <span className="text-muted-foreground"> · {l.company_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-xs uppercase tracking-wider text-muted-foreground">
                    {l.status.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <span
                      className={
                        l.stage_age_days >= 14 ? "text-destructive font-medium" : "text-muted-foreground"
                      }
                    >
                      {l.stage_age_days}d
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueueCard>

        <QueueCard
          title="Cheques Due This Week"
          count={queues.cheques_due_this_week.length}
          viewAllTo="/lifecycle"
          emptyMessage="No cheques due in the next 7 days."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9">Lease</TableHead>
                <TableHead className="h-9">Amount</TableHead>
                <TableHead className="h-9">Due</TableHead>
                <TableHead className="h-9">Countdown</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.cheques_due_this_week.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="py-2 mono text-xs">{c.lease_contract_number ?? "—"}</TableCell>
                  <TableCell className="py-2 text-sm">{formatCurrency(c.amount, "AED")}</TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">{c.due_date}</TableCell>
                  <TableCell className="py-2 text-xs">
                    <span
                      className={
                        c.days_until_due <= 1 ? "text-destructive font-medium" : "text-amber-700"
                      }
                    >
                      {c.days_until_due === 0
                        ? "Today"
                        : c.days_until_due === 1
                          ? "Tomorrow"
                          : `${c.days_until_due}d`}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueueCard>

        <QueueCard
          title="Awaiting My Response"
          count={queues.awaiting_my_response.length}
          viewAllTo="/tickets"
          emptyMessage="No tickets awaiting your response."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9">TKT #</TableHead>
                <TableHead className="h-9">Subject</TableHead>
                <TableHead className="h-9">Days Waiting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.awaiting_my_response.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/tickets/${t.id}`)}
                >
                  <TableCell className="py-2 mono text-xs">{t.ticket_number}</TableCell>
                  <TableCell className="py-2 text-sm truncate max-w-[260px]">{t.subject}</TableCell>
                  <TableCell className="py-2 text-xs">
                    <span
                      className={t.days_waiting >= 3 ? "text-destructive font-medium" : "text-amber-700"}
                    >
                      {t.days_waiting}d
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueueCard>
      </section>

      {/* Quick actions */}
      <section className="border-t hairline pt-6 flex flex-wrap gap-2">
        <Button asChild variant="default" size="sm">
          <Link to="/tickets">
            <Plus className="h-4 w-4" />
            New ticket
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/leads">
            <Plus className="h-4 w-4" />
            New lead
          </Link>
        </Button>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview tab                                                               */
/* -------------------------------------------------------------------------- */

function OverviewTab() {
  const [data, setData] = useState<ManagementDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: rpc, error: rpcErr } = await supabase.rpc("get_management_dashboard");
      if (rpcErr) setError(rpcErr.message);
      else setData(rpc as unknown as ManagementDashboard);
      setLoading(false);
    })();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;

  const { kpis, attention_items: a } = data;
  const score = kpis.attention_score;
  const scoreTone = attentionScoreTone(score);

  return (
    <div className="space-y-10">
      {/* KPI strip — 8 cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8 gap-4">
        <KpiCard
          label="Units Managed"
          value={formatCompact(kpis.units_managed.total)}
          delta={kpis.units_managed.delta_this_period}
          subtitle="this period"
        />
        <KpiCard
          label="Occupancy"
          value={`${Math.round(kpis.occupancy_rate.percent)}%`}
          delta={kpis.occupancy_rate.delta}
          formatDelta={(n) => `${n > 0 ? "+" : ""}${n.toFixed(1)}pp`}
          subtitle={`${kpis.occupancy_rate.occupied}/${kpis.occupancy_rate.total} units`}
        />
        <KpiCard
          label="Annual Rent Roll"
          value={formatCurrency(kpis.annualized_rent_roll.amount, kpis.annualized_rent_roll.currency)}
          delta={kpis.annualized_rent_roll.delta}
          formatDelta={(n) => formatCurrency(n, kpis.annualized_rent_roll.currency)}
          subtitle={`${kpis.active_leases.total} active leases`}
        />
        <KpiCard
          label="Annual PM Fees"
          value={formatCurrency(kpis.annualized_pm_fees.amount, kpis.annualized_pm_fees.currency)}
          subtitle={`${kpis.annualized_pm_fees.active_agreements} agreements`}
        />
        <KpiCard
          label="Active Leases"
          value={formatCompact(kpis.active_leases.total)}
          subtitle={
            <span className={kpis.active_leases.expiring_90d > 0 ? "text-amber-700 font-medium" : ""}>
              {kpis.active_leases.expiring_90d} expiring in 90d
            </span>
          }
        />
        <KpiCard
          label="Open Tickets"
          value={formatCompact(kpis.open_tickets.total)}
          subtitle={
            <span className={kpis.open_tickets.urgent > 0 ? "text-destructive font-medium" : ""}>
              {kpis.open_tickets.urgent} urgent
            </span>
          }
          to="/tickets"
        />
        <KpiCard
          label="Weighted Pipeline"
          value={formatCurrency(kpis.weighted_pipeline_value.amount, kpis.weighted_pipeline_value.currency)}
          subtitle="Expected fee value"
          to="/leads"
        />
        <KpiCard
          label="Attention Score"
          value={formatCompact(score)}
          subtitle={`${score} item${score === 1 ? "" : "s"} need action`}
          tone={scoreTone === "ok" ? "ok" : scoreTone === "warn" ? "warn" : "alert"}
        />
      </section>

      {/* Trends placeholder */}
      <section className="border hairline rounded-sm bg-muted/30 p-6 text-center">
        <div className="label-eyebrow text-gold">Trends</div>
        <p className="text-sm text-muted-foreground mt-2">
          Charts coming in the next update. In the meantime, each module page has its own KPI strip.
        </p>
      </section>

      {/* Attention Needed */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl text-architect">Attention Needed</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Items currently flagged across the portfolio. Drill into any card for the full list.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AttentionCard
            title="Overdue Cheques"
            primary={a.overdue_cheques.count}
            secondary={
              a.overdue_cheques.count > 0
                ? `Total ${formatCurrency(a.overdue_cheques.total_amount, a.overdue_cheques.currency)}`
                : "All cheques on track"
            }
            topItems={a.overdue_cheques.top_5}
            viewAllTo="/lifecycle"
          />
          <AttentionCard
            title="Leases Expiring"
            primary={a.leases_expiring.in_90d}
            secondary={`${a.leases_expiring.in_30d} in 30d · ${a.leases_expiring.in_60d} in 60d · ${a.leases_expiring.in_90d} in 90d`}
            topItems={a.leases_expiring.top_5}
            viewAllTo="/lifecycle"
            tone={a.leases_expiring.in_30d > 0 ? "alert" : a.leases_expiring.in_90d > 0 ? "warn" : "ok"}
          />
          <AttentionCard
            title="Stuck Leads"
            primary={a.stuck_leads.count}
            secondary={
              a.stuck_leads.count > 0
                ? `${formatCurrency(a.stuck_leads.weighted_value, a.stuck_leads.currency)} weighted`
                : "Pipeline moving"
            }
            topItems={a.stuck_leads.top_5}
            viewAllTo="/leads"
            tone={a.stuck_leads.count > 0 ? "warn" : "ok"}
          />
          <AttentionCard
            title="Compliance Expiring (60d)"
            primary={
              a.compliance_expiring.mgmt_agreements_60d +
              a.compliance_expiring.vendor_trade_license_60d +
              a.compliance_expiring.vendor_insurance_60d
            }
            customBody={
              <ul className="mt-3 space-y-1 text-xs">
                <ComplianceRow
                  label="Mgmt agreements"
                  count={a.compliance_expiring.mgmt_agreements_60d}
                  to="/contracts"
                />
                <ComplianceRow
                  label="Vendor trade licenses"
                  count={a.compliance_expiring.vendor_trade_license_60d}
                  to="/vendors"
                />
                <ComplianceRow
                  label="Vendor insurance"
                  count={a.compliance_expiring.vendor_insurance_60d}
                  to="/vendors"
                />
              </ul>
            }
          />
          <AttentionCard
            title="Data Gaps"
            primary={
              a.data_gaps.units_without_owners +
              a.data_gaps.occupied_no_lease +
              a.data_gaps.unlinked_auth_users
            }
            customBody={
              <ul className="mt-3 space-y-1 text-xs">
                <ComplianceRow
                  label="Units without owners"
                  count={a.data_gaps.units_without_owners}
                  to="/properties"
                />
                <ComplianceRow
                  label="Occupied — no lease"
                  count={a.data_gaps.occupied_no_lease}
                  to="/properties"
                />
                <ComplianceRow
                  label="Unlinked auth users"
                  count={a.data_gaps.unlinked_auth_users}
                  to="/settings"
                />
              </ul>
            }
          />
          <AttentionCard
            title="Aging Tickets (>30d)"
            primary={a.aging_tickets.count_over_30_days}
            secondary={
              a.aging_tickets.count_over_30_days > 0
                ? "Open more than a month"
                : "No long-running tickets"
            }
            topItems={a.aging_tickets.top_5}
            viewAllTo="/tickets"
          />
        </div>
      </section>
    </div>
  );
}

function ComplianceRow({ label, count, to }: { label: string; count: number; to: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center justify-between gap-2 hover:bg-muted/40 px-1.5 -mx-1.5 py-0.5 rounded-sm transition-colors"
      >
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("mono", count > 0 ? "text-architect font-medium" : "text-muted-foreground")}>
          {count}
        </span>
      </Link>
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card border hairline rounded-sm p-5 h-[120px] animate-pulse">
            <div className="h-3 w-16 bg-muted rounded-sm" />
            <div className="h-8 w-14 bg-muted rounded-sm mt-4" />
          </div>
        ))}
      </div>
    </div>
  );
}