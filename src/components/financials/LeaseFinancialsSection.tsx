import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BalanceBadge } from "@/components/financials/BalanceBadge";
import { RecordPaymentDialog } from "@/components/financials/RecordPaymentDialog";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  invoiceBalance,
  daysPastDue,
} from "@/lib/financialFormulas";
import { generateLeaseInvoiceSchedule, INVOICE_STATUS_LABEL } from "@/lib/financials";

interface LeaseFinancialsSectionProps {
  contractId: string;
  unitId: string;
  startDate: string | null;
  rentAmount: number;
  numberOfCheques: number | null;
  currency: string;
  /** Tenant person id (primary party with role=tenant). */
  tenantPersonId: string | null;
  /** Lease activation status — generation only allowed once active. */
  contractStatus: string;
}

interface InvRow {
  id: string;
  number: string;
  due_date: string;
  total: number;
  amount_paid: number;
  status: string;
  currency: string;
}

export function LeaseFinancialsSection({
  contractId,
  unitId,
  startDate,
  rentAmount,
  numberOfCheques,
  currency,
  tenantPersonId,
  contractStatus,
}: LeaseFinancialsSectionProps) {
  const { activeWorkspace } = useWorkspace();
  const [invs, setInvs] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("id, number, due_date, total, amount_paid, status, currency")
      .eq("lease_contract_id", contractId)
      .order("due_date");
    setInvs((data as InvRow[]) ?? []);
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!startDate || !rentAmount || !numberOfCheques) {
      toast.error("Lease is missing rent amount, start date or installment count.");
      return;
    }
    if (!activeWorkspace?.id) {
      toast.error("No active workspace selected.");
      return;
    }
    setGenerating(true);
    try {
      const res = await generateLeaseInvoiceSchedule({
        leaseContractId: contractId,
        unitId,
        startDate,
        rentAmount,
        numberOfCheques,
        currency,
        tenantPersonId,
        workspaceId: activeWorkspace.id,
      });
      if (res.skipped) {
        toast.info("Schedule already generated for this lease.");
      } else {
        toast.success(`Generated ${res.created} invoice${res.created === 1 ? "" : "s"}.`);
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate schedule");
    } finally {
      setGenerating(false);
    }
  };

  const summary = useMemo(() => {
    const open = invs.filter((i) => i.status !== "paid" && i.status !== "void" && i.status !== "draft");
    const outstanding = open.reduce((s, i) => s + invoiceBalance(i), 0);
    const overdue = open
      .filter((i) => daysPastDue(i.due_date) > 0)
      .reduce((s, i) => s + invoiceBalance(i), 0);
    const collected = invs
      .filter((i) => i.status !== "void")
      .reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
    const next = open
      .slice()
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .find((i) => invoiceBalance(i) > 0);
    return { outstanding, overdue, collected, next };
  }, [invs]);

  const canGenerate =
    contractStatus === "active" && invs.length === 0 && !!startDate && !!rentAmount && !!numberOfCheques;
  const hasPayables = invs.some((i) => invoiceBalance(i) > 0 && i.status !== "void" && i.status !== "draft");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-architect">Rent collection</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tenant invoices and payments tied to this lease.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canGenerate && (
            <Button onClick={handleGenerate} disabled={generating}>
              <CalendarPlus className="h-4 w-4" />
              {generating ? "Generating…" : "Generate invoice schedule"}
            </Button>
          )}
          {hasPayables && (
            <Button variant="outline" onClick={() => setPayOpen(true)}>
              <CreditCard className="h-4 w-4" />
              Record payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Outstanding" value={summary.outstanding} currency={currency} tone={summary.overdue > 0 ? "danger" : "neutral"} />
        <Stat label="Overdue" value={summary.overdue} currency={currency} tone="danger" />
        <Stat label="Collected to date" value={summary.collected} currency={currency} tone="ok" />
        <Stat
          label="Next due"
          textValue={summary.next ? new Date(summary.next.due_date).toLocaleDateString() : "—"}
        />
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Loading invoices…</div>
      ) : invs.length === 0 ? (
        <div className="border hairline rounded-sm bg-muted/30 px-5 py-6 text-center text-xs text-muted-foreground">
          No invoices yet.{" "}
          {contractStatus !== "active"
            ? "Activate the lease to generate the rent schedule."
            : "Use the button above to generate the rent schedule."}
        </div>
      ) : (
        <div className="border hairline rounded-sm bg-card overflow-hidden">
          <div className="table-scroll">
          <table className="w-full text-sm min-w-[680px]">
            <thead className="border-b hairline bg-muted/30">
              <tr className="text-left">
                <th className="px-4 py-2.5 label-eyebrow text-muted-foreground font-normal">Invoice</th>
                <th className="px-4 py-2.5 label-eyebrow text-muted-foreground font-normal">Due</th>
                <th className="px-4 py-2.5 label-eyebrow text-muted-foreground font-normal text-right">Total</th>
                <th className="px-4 py-2.5 label-eyebrow text-muted-foreground font-normal text-right">Paid</th>
                <th className="px-4 py-2.5 label-eyebrow text-muted-foreground font-normal text-right">Balance</th>
                <th className="px-4 py-2.5 label-eyebrow text-muted-foreground font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {invs.map((i) => {
                const bal = invoiceBalance(i);
                const dpd = daysPastDue(i.due_date);
                const isOverdue = bal > 0 && dpd > 0 && i.status !== "void";
                return (
                  <tr key={i.id} className="border-b hairline last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to={`/financials/invoices/${i.id}`} className="mono text-xs text-architect hover:underline">
                        {i.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(i.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(i.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(i.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <BalanceBadge balance={bal} currency={i.currency} earliestDueDate={i.due_date} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {isOverdue ? "Overdue" : INVOICE_STATUS_LABEL[i.status] ?? i.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <RecordPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoices={invs.filter((i) => invoiceBalance(i) > 0 && i.status !== "void" && i.status !== "draft")}
        partyPersonId={tenantPersonId}
        currency={currency}
        onSaved={load}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  currency,
  tone = "neutral",
  textValue,
}: {
  label: string;
  value?: number;
  currency?: string;
  tone?: "ok" | "neutral" | "danger";
  textValue?: string;
}) {
  const colorCls =
    tone === "danger" && value && value > 0
      ? "text-red-700 dark:text-red-300"
      : tone === "ok" && value && value > 0
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-architect";
  return (
    <div className="border hairline rounded-sm bg-card p-4">
      <div className="label-eyebrow text-muted-foreground mb-1.5">{label}</div>
      <div className={`font-display text-lg tabular-nums ${colorCls}`}>
        {textValue !== undefined
          ? textValue
          : `${currency ?? ""} ${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </div>
    </div>
  );
}
