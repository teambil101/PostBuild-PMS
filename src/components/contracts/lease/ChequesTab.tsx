import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CHEQUE_STATUS_LABELS, CHEQUE_STATUS_STYLES, type ChequeStatus,
  chequeDueCountdown, BOUNCE_REASON_LABELS, type BounceReason,
} from "@/lib/leases";
import { Banknote, CheckCircle2, XCircle, RefreshCw, Loader2, Inbox } from "lucide-react";
import { DepositChequeDialog } from "./dialogs/DepositChequeDialog";
import { ClearChequeDialog } from "./dialogs/ClearChequeDialog";
import { BounceChequeDialog } from "./dialogs/BounceChequeDialog";
import { ReplaceChequeDialog } from "./dialogs/ReplaceChequeDialog";

interface ChequeRow {
  id: string;
  lease_id: string;
  sequence_number: number;
  amount: number;
  due_date: string;
  status: ChequeStatus;
  cheque_number: string | null;
  bank_name: string | null;
  deposited_on: string | null;
  cleared_on: string | null;
  bounced_on: string | null;
  bounce_reason: BounceReason | null;
  notes: string | null;
  replacement_cheque_id: string | null;
}

interface Props {
  leaseId: string;
  contractId: string;
  currency: string;
  canEdit: boolean;
}

export function ChequesTab({ leaseId, contractId, currency, canEdit }: Props) {
  const [rows, setRows] = useState<ChequeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<{ row: ChequeRow; action: "deposit" | "clear" | "bounce" | "replace" } | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lease_cheques" as never)
      .select("*")
      .eq("lease_id" as never, leaseId as never)
      .order("sequence_number" as never, { ascending: true } as never);
    if (error) {
      console.warn("Could not load cheques", error);
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as ChequeRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId]);

  const totals = useMemo(() => {
    const sum = (status: ChequeStatus[]) =>
      rows.filter((r) => status.includes(r.status)).reduce((a, b) => a + Number(b.amount), 0);
    return {
      total: rows.filter((r) => r.status !== "replaced").reduce((a, b) => a + Number(b.amount), 0),
      collected: sum(["cleared"]),
      inFlight: sum(["deposited"]),
      pending: sum(["pending"]),
      issues: sum(["bounced", "returned"]),
    };
  }, [rows]);

  const nextSequence = useMemo(() => {
    if (rows.length === 0) return 1;
    return Math.max(...rows.map((r) => r.sequence_number)) + 1;
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border hairline rounded-sm bg-card p-8 text-center">
        <Inbox className="h-8 w-8 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
        <p className="text-sm text-architect mb-1">No cheque schedule</p>
        <p className="text-xs text-muted-foreground">
          Cheques will appear here once the lease has a schedule. Edit the lease to generate one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Totals strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TotalChip label="Pending" amount={totals.pending} currency={currency} tone="neutral" />
        <TotalChip label="In flight" amount={totals.inFlight} currency={currency} tone="blue" />
        <TotalChip label="Collected" amount={totals.collected} currency={currency} tone="green" />
        <TotalChip label="Bounced / returned" amount={totals.issues} currency={currency} tone="red" />
      </div>

      {/* Table */}
      <div className="border hairline rounded-sm bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b hairline text-left">
              <tr>
                <th className="px-3 py-3 label-eyebrow w-12">#</th>
                <th className="px-3 py-3 label-eyebrow">Due date</th>
                <th className="px-3 py-3 label-eyebrow text-right">Amount</th>
                <th className="px-3 py-3 label-eyebrow">Status</th>
                <th className="px-3 py-3 label-eyebrow">Cheque #</th>
                <th className="px-3 py-3 label-eyebrow">Bank</th>
                <th className="px-3 py-3 label-eyebrow">Activity</th>
                {canEdit && <th className="px-3 py-3 label-eyebrow text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ChequeRowView
                  key={r.id}
                  row={r}
                  currency={currency}
                  canEdit={canEdit}
                  onAction={(action) => setTarget({ row: r, action })}
                />
              ))}
            </tbody>
            <tfoot className="bg-muted/30 border-t hairline">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider">Total scheduled</td>
                <td className="px-3 py-2 text-right text-architect mono text-sm">{currency} {totals.total.toLocaleString()}</td>
                <td colSpan={canEdit ? 5 : 4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Action dialogs */}
      {target?.action === "deposit" && (
        <DepositChequeDialog
          open
          onOpenChange={(v) => !v && setTarget(null)}
          chequeId={target.row.id}
          contractId={contractId}
          sequence={target.row.sequence_number}
          defaultBank={target.row.bank_name}
          defaultChequeNumber={target.row.cheque_number}
          onSaved={reload}
        />
      )}
      {target?.action === "clear" && (
        <ClearChequeDialog
          open
          onOpenChange={(v) => !v && setTarget(null)}
          chequeId={target.row.id}
          contractId={contractId}
          sequence={target.row.sequence_number}
          amount={Number(target.row.amount)}
          currency={currency}
          onSaved={reload}
        />
      )}
      {target?.action === "bounce" && (
        <BounceChequeDialog
          open
          onOpenChange={(v) => !v && setTarget(null)}
          chequeId={target.row.id}
          contractId={contractId}
          sequence={target.row.sequence_number}
          onSaved={reload}
        />
      )}
      {target?.action === "replace" && (
        <ReplaceChequeDialog
          open
          onOpenChange={(v) => !v && setTarget(null)}
          bouncedChequeId={target.row.id}
          leaseId={leaseId}
          contractId={contractId}
          bouncedSequence={target.row.sequence_number}
          bouncedAmount={Number(target.row.amount)}
          bouncedDueDate={target.row.due_date}
          nextSequence={nextSequence}
          currency={currency}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function ChequeRowView({
  row, currency, canEdit, onAction,
}: {
  row: ChequeRow;
  currency: string;
  canEdit: boolean;
  onAction: (a: "deposit" | "clear" | "bounce" | "replace") => void;
}) {
  const due = chequeDueCountdown(row.due_date);
  const dimmed = row.status === "replaced";
  const activity = (() => {
    if (row.status === "cleared" && row.cleared_on) return `Cleared ${format(new Date(row.cleared_on), "MMM d, yyyy")}`;
    if (row.status === "deposited" && row.deposited_on) return `Deposited ${format(new Date(row.deposited_on), "MMM d, yyyy")}`;
    if (row.status === "bounced" && row.bounced_on) {
      const reason = row.bounce_reason ? ` · ${BOUNCE_REASON_LABELS[row.bounce_reason]}` : "";
      return `Bounced ${format(new Date(row.bounced_on), "MMM d, yyyy")}${reason}`;
    }
    if (row.status === "replaced") return "Superseded by replacement";
    if (row.status === "pending") {
      const tone = due.tone === "red" ? "text-destructive" : due.tone === "amber" ? "text-amber-700" : "text-muted-foreground";
      return <span className={tone}>{due.label}</span>;
    }
    return "—";
  })();

  return (
    <tr className={cn("border-b hairline last:border-0 hover:bg-muted/30", dimmed && "opacity-60")}>
      <td className="px-3 py-3 mono text-xs text-muted-foreground">#{row.sequence_number}</td>
      <td className="px-3 py-3 text-architect">{format(new Date(row.due_date), "MMM d, yyyy")}</td>
      <td className="px-3 py-3 text-right text-architect mono">{currency} {Number(row.amount).toLocaleString()}</td>
      <td className="px-3 py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium whitespace-nowrap",
            CHEQUE_STATUS_STYLES[row.status],
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {CHEQUE_STATUS_LABELS[row.status]}
        </span>
      </td>
      <td className="px-3 py-3 text-muted-foreground mono text-xs">{row.cheque_number ?? "—"}</td>
      <td className="px-3 py-3 text-muted-foreground text-xs">{row.bank_name ?? "—"}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{activity}</td>
      {canEdit && (
        <td className="px-3 py-3 text-right">
          <ChequeActions status={row.status} onAction={onAction} />
        </td>
      )}
    </tr>
  );
}

function ChequeActions({
  status, onAction,
}: { status: ChequeStatus; onAction: (a: "deposit" | "clear" | "bounce" | "replace") => void }) {
  if (status === "pending") {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onAction("deposit")} title="Mark deposited">
          <Banknote className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => onAction("bounce")} title="Mark bounced">
          <XCircle className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }
  if (status === "deposited") {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-status-occupied hover:text-status-occupied" onClick={() => onAction("clear")} title="Mark cleared">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => onAction("bounce")} title="Mark bounced">
          <XCircle className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }
  if (status === "bounced") {
    return (
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onAction("replace")} title="Issue replacement">
        <RefreshCw className="h-3.5 w-3.5" /> <span className="ml-1 text-[11px]">Replace</span>
      </Button>
    );
  }
  return <span className="text-[11px] text-muted-foreground">—</span>;
}

function TotalChip({
  label, amount, currency, tone,
}: { label: string; amount: number; currency: string; tone: "neutral" | "blue" | "green" | "red" }) {
  const toneClass = {
    neutral: "text-architect",
    blue: "text-blue-700",
    green: "text-status-occupied",
    red: "text-destructive",
  }[tone];
  return (
    <div className="border hairline rounded-sm bg-card p-3">
      <div className="label-eyebrow mb-1">{label}</div>
      <div className={cn("text-sm mono", toneClass)}>{currency} {amount.toLocaleString()}</div>
    </div>
  );
}