import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { invoiceBalance, daysPastDue, agingBucket } from "@/lib/financialFormulas";
import { INVOICE_STATUS_LABEL } from "@/lib/financials";
import { BalanceBadge } from "@/components/financials/BalanceBadge";
import { EmptyState } from "@/components/EmptyState";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface InvRow {
  id: string;
  number: string;
  issue_date: string;
  due_date: string;
  currency: string;
  total: number;
  amount_paid: number;
  status: string;
  bill_to_role: string;
  party_person_id: string | null;
  contract_id: string | null;
  party: { first_name: string; last_name: string; company: string | null } | null;
  contract: { contract_number: string } | null;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "outstanding", label: "Outstanding" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "draft", label: "Draft" },
] as const;

export function Receivables() {
  const [rows, setRows] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select(`
        id, number, issue_date, due_date, currency, total, amount_paid, status,
        bill_to_role, party_person_id, contract_id,
        party:people!invoices_party_person_id_fkey(first_name, last_name, company),
        contract:contracts(contract_number)
      `)
      .order("due_date", { ascending: true });
    setRows((data as any) ?? []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "outstanding" && (r.status === "paid" || r.status === "void" || r.status === "draft")) return false;
      if (filter === "overdue") {
        if (r.status === "paid" || r.status === "void") return false;
        if (daysPastDue(r.due_date) <= 0) return false;
      }
      if (filter === "paid" && r.status !== "paid") return false;
      if (filter === "draft" && r.status !== "draft") return false;
      if (search) {
        const q = search.toLowerCase();
        const partyName = r.party ? `${r.party.first_name} ${r.party.last_name} ${r.party.company ?? ""}`.toLowerCase() : "";
        if (!r.number.toLowerCase().includes(q) && !partyName.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const totals = useMemo(() => {
    const outstanding = rows
      .filter((r) => r.status !== "paid" && r.status !== "void" && r.status !== "draft")
      .reduce((s, r) => s + invoiceBalance(r), 0);
    const overdue = rows
      .filter((r) => r.status !== "paid" && r.status !== "void" && r.status !== "draft" && daysPastDue(r.due_date) > 0)
      .reduce((s, r) => s + invoiceBalance(r), 0);
    return { outstanding, overdue, count: rows.length };
  }, [rows]);

  if (loading) return <div className="text-sm text-muted-foreground py-12 text-center">Loading invoices…</div>;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" strokeWidth={1.4} />}
        title="No invoices yet"
        description="Activate a lease to auto-generate the rent invoice schedule, or create a one-off invoice from a contract or person."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Outstanding" value={totals.outstanding} currency={rows[0]?.currency ?? "AED"} />
        <SummaryCard label="Overdue" value={totals.overdue} currency={rows[0]?.currency ?? "AED"} tone="danger" />
        <SummaryCard label="Invoices on file" value={totals.count} numeric />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-sm border transition",
              filter === f.key
                ? "bg-architect text-architect-foreground border-architect"
                : "bg-card border-border text-muted-foreground hover:text-architect",
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="relative w-full sm:w-64 sm:ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice # or party"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      <div className="border hairline rounded-sm bg-card overflow-hidden">
        <div className="table-scroll">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="border-b hairline bg-muted/30">
            <tr className="text-left">
              <Th>Number</Th>
              <Th>Party</Th>
              <Th>Contract</Th>
              <Th>Issued</Th>
              <Th>Due</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Balance</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const balance = invoiceBalance(r);
              return (
                <tr key={r.id} className="border-b hairline last:border-0 hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <Link to={`/financials/invoices/${r.id}`} className="font-medium text-architect hover:underline mono">
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-architect">
                    {r.party ? `${r.party.first_name} ${r.party.last_name}${r.party.company ? ` · ${r.party.company}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 mono text-xs text-muted-foreground">
                    {r.contract?.contract_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.issue_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.due_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.currency} {Number(r.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <BalanceBadge balance={balance} currency={r.currency} earliestDueDate={r.due_date} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <StatusPill status={r.status} dueDate={r.due_date} hasBalance={balance > 0} />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No invoices match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-3 label-eyebrow text-muted-foreground font-normal", className)}>
      {children}
    </th>
  );
}

function SummaryCard({
  label,
  value,
  currency,
  tone = "neutral",
  numeric,
}: {
  label: string;
  value: number;
  currency?: string;
  tone?: "neutral" | "danger";
  numeric?: boolean;
}) {
  return (
    <div className="border hairline rounded-sm bg-card p-5">
      <div className="label-eyebrow text-muted-foreground mb-2">{label}</div>
      <div
        className={cn(
          "font-display text-2xl tabular-nums",
          tone === "danger" && value > 0 ? "text-red-700 dark:text-red-300" : "text-architect",
        )}
      >
        {numeric
          ? value
          : `${currency ?? "AED"} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </div>
    </div>
  );
}

function StatusPill({ status, dueDate, hasBalance }: { status: string; dueDate: string; hasBalance: boolean }) {
  // Promote to "Overdue" if past due date and unpaid
  const isOverdue = hasBalance && status !== "paid" && status !== "void" && daysPastDue(dueDate) > 0;
  const label = isOverdue ? "Overdue" : INVOICE_STATUS_LABEL[status] ?? status;
  const cls = isOverdue
    ? "bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900"
    : status === "paid"
    ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900"
    : status === "partial"
    ? "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900"
    : "bg-muted/60 text-foreground border-border";
  return <span className={cn("inline-flex items-center px-2 py-0.5 text-[11px] rounded-sm border", cls)}>{label}</span>;
}
