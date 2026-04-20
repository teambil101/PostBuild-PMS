import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ExternalLink, User } from "lucide-react";
import { chequeDueCountdown, monthlyEquivalent, type ChequeStatus } from "@/lib/leases";

interface Props {
  leaseId: string;
  annualRent: number;
  currency: string;
  tenant: { id: string; name: string } | null;
}

interface NextChequeRow {
  id: string;
  sequence_number: number;
  amount: number;
  due_date: string;
  status: ChequeStatus;
}

export function LeaseSummaryCards({ leaseId, annualRent, currency, tenant }: Props) {
  const [nextCheque, setNextCheque] = useState<NextChequeRow | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("lease_cheques" as never)
        .select("id, sequence_number, amount, due_date, status")
        .eq("lease_id" as never, leaseId as never)
        .eq("status" as never, "pending" as never)
        .order("due_date" as never, { ascending: true } as never);
      if (cancelled) return;
      const rows = (data ?? []) as unknown as NextChequeRow[];
      setPendingCount(rows.length);
      setNextCheque(rows[0] ?? null);
    })();
    return () => { cancelled = true; };
  }, [leaseId]);

  const monthly = useMemo(() => monthlyEquivalent(annualRent), [annualRent]);
  const due = nextCheque ? chequeDueCountdown(nextCheque.due_date) : null;

  const dueToneClass = due?.tone === "red"
    ? "text-destructive"
    : due?.tone === "amber" ? "text-amber-700" : "text-muted-foreground";

  return (
    <>
      <SummaryCard label="Annual rent">
        <div className="text-sm text-architect mono">{currency} {annualRent.toLocaleString()}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">≈ {currency} {monthly.toLocaleString()}/mo</div>
      </SummaryCard>

      <SummaryCard label="Next cheque">
        {nextCheque ? (
          <>
            <div className="text-sm text-architect mono">{currency} {Number(nextCheque.amount).toLocaleString()}</div>
            <div className={cn("text-[11px] mt-0.5", dueToneClass)}>
              {format(new Date(nextCheque.due_date), "MMM d")} · {due?.label}
            </div>
            {pendingCount > 1 && (
              <div className="text-[10px] mono uppercase text-muted-foreground mt-0.5">
                +{pendingCount - 1} more pending
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">All cleared</div>
        )}
      </SummaryCard>

      <SummaryCard label="Tenant">
        {tenant ? (
          <Link
            to={`/people/${tenant.id}`}
            className="text-sm text-architect hover:text-gold-deep inline-flex items-center gap-1.5"
          >
            <User className="h-3.5 w-3.5 text-true-taupe" strokeWidth={1.5} />
            <span className="truncate">{tenant.name}</span>
            <ExternalLink className="h-3 w-3 opacity-50" />
          </Link>
        ) : (
          <div className="text-sm text-muted-foreground">—</div>
        )}
      </SummaryCard>
    </>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border hairline rounded-sm bg-card p-3">
      <div className="label-eyebrow mb-1.5">{label}</div>
      {children}
    </div>
  );
}