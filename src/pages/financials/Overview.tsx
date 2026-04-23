import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invoiceBalance, agingBucket, daysPastDue } from "@/lib/financialFormulas";
import { BalanceBadge } from "@/components/financials/BalanceBadge";
import { cn } from "@/lib/utils";

interface InvLite {
  id: string;
  number: string;
  due_date: string;
  total: number;
  amount_paid: number;
  status: string;
  currency: string;
  party: { first_name: string; last_name: string; company: string | null } | null;
}

export function Overview() {
  const [invs, setInvs] = useState<InvLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select(`
        id, number, due_date, total, amount_paid, status, currency,
        party:people!invoices_party_person_id_fkey(first_name, last_name, company)
      `)
      .neq("status", "void")
      .neq("status", "draft")
      .order("due_date");
    setInvs((data as any) ?? []);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const open = invs.filter((i) => i.status !== "paid");
    const outstanding = open.reduce((s, i) => s + invoiceBalance(i), 0);
    const buckets = { current: 0, "1-30": 0, "31-60": 0, "60+": 0 } as Record<string, number>;
    for (const i of open) {
      const b = agingBucket(i.due_date);
      buckets[b] += invoiceBalance(i);
    }
    const overdue = buckets["1-30"] + buckets["31-60"] + buckets["60+"];
    const dueSoon = open
      .filter((i) => {
        const d = daysPastDue(i.due_date);
        return d <= 0 && d > -8 && invoiceBalance(i) > 0;
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const overdueList = open
      .filter((i) => daysPastDue(i.due_date) > 0 && invoiceBalance(i) > 0)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    return { outstanding, overdue, buckets, dueSoon, overdueList };
  }, [invs]);

  const currency = invs[0]?.currency ?? "AED";

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="AR outstanding" amount={stats.outstanding} currency={currency} />
        <KpiCard label="Overdue" amount={stats.overdue} currency={currency} tone="danger" />
        <KpiCard label="Cash on hand" amount={0} currency={currency} muted hint="Coming with bank reconciliation" />
        <KpiCard label="Owner payable" amount={0} currency={currency} muted hint="Activates with statements (Phase 4)" />
      </div>

      {/* Aging */}
      <div className="border hairline rounded-sm bg-card p-5">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="label-eyebrow text-muted-foreground mb-1">AR aging</div>
            <h2 className="font-display text-xl text-architect">By bucket</h2>
          </div>
          <Link to="/financials" className="text-xs text-architect hover:underline">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-px bg-border rounded-sm overflow-hidden">
          {(["current", "1-30", "31-60", "60+"] as const).map((b) => (
            <div key={b} className="bg-card p-4 text-center">
              <div className="label-eyebrow text-muted-foreground mb-1.5">
                {b === "current" ? "Current" : `${b} days`}
              </div>
              <div
                className={cn(
                  "font-display text-lg tabular-nums",
                  b === "60+" && stats.buckets[b] > 0 && "text-red-700 dark:text-red-300",
                  b === "31-60" && stats.buckets[b] > 0 && "text-amber-700 dark:text-amber-300",
                )}
              >
                {currency} {stats.buckets[b].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action lists */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ActionList
          title="Overdue invoices"
          empty="No overdue invoices."
          items={stats.overdueList.slice(0, 6)}
          loading={loading}
        />
        <ActionList
          title="Due in the next 7 days"
          empty="Nothing due this week."
          items={stats.dueSoon.slice(0, 6)}
          loading={loading}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  amount,
  currency,
  tone = "neutral",
  muted,
  hint,
}: {
  label: string;
  amount: number;
  currency: string;
  tone?: "neutral" | "danger";
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div className="border hairline rounded-sm bg-card p-5">
      <div className="label-eyebrow text-muted-foreground mb-2">{label}</div>
      <div
        className={cn(
          "font-display text-2xl tabular-nums",
          muted ? "text-muted-foreground" : tone === "danger" && amount > 0 ? "text-red-700 dark:text-red-300" : "text-architect",
        )}
      >
        {muted && !amount ? "—" : `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-2">{hint}</div>}
    </div>
  );
}

function ActionList({
  title,
  items,
  empty,
  loading,
}: {
  title: string;
  items: InvLite[];
  empty: string;
  loading: boolean;
}) {
  return (
    <div className="border hairline rounded-sm bg-card p-5">
      <div className="label-eyebrow text-muted-foreground mb-3">{title}</div>
      {loading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">{empty}</div>
      ) : (
        <div className="space-y-2">
          {items.map((i) => {
            const bal = invoiceBalance(i);
            return (
              <Link
                key={i.id}
                to={`/financials/invoices/${i.id}`}
                className="flex items-center justify-between gap-3 py-2 border-b hairline last:border-0 hover:text-architect group"
              >
                <div className="min-w-0">
                  <div className="text-sm text-architect truncate">
                    {i.party
                      ? `${i.party.first_name} ${i.party.last_name}${i.party.company ? ` · ${i.party.company}` : ""}`
                      : "Unassigned"}
                  </div>
                  <div className="mono text-[11px] text-muted-foreground">
                    {i.number} · due {new Date(i.due_date).toLocaleDateString()}
                  </div>
                </div>
                <BalanceBadge balance={bal} currency={i.currency} earliestDueDate={i.due_date} size="sm" />
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
