import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Scale, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { daysPastDue, invoiceBalance } from "@/lib/financialFormulas";
import { LegalOptionsDialog } from "./LegalOptionsDialog";
import { cn } from "@/lib/utils";

interface OverdueRow {
  id: string;
  number: string;
  due_date: string;
  balance: number;
  dpd: number;
  party_label: string;
}

/**
 * Shows the owner any rent invoices past their due date.
 * Hidden when nothing is overdue.
 */
export function OverdueRentAlert({ servicesHref = "/owner/services" }: { servicesHref?: string }) {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [legalOpen, setLegalOpen] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      // Rent-related invoices = those linked to a lease contract.
      const { data, error } = await supabase
        .from("invoices")
        .select(
          `id, number, due_date, total, amount_paid, status, lease_contract_id,
           party_person_id, people:party_person_id(first_name, last_name, company)`,
        )
        .eq("workspace_id", activeWorkspace.id)
        .not("lease_contract_id", "is", null)
        .not("status", "in", "(paid,void,cancelled)")
        .order("due_date", { ascending: true });
      if (error) {
        setLoading(false);
        return;
      }
      const today = new Date();
      const overdue: OverdueRow[] = [];
      for (const inv of (data ?? []) as any[]) {
        const balance = invoiceBalance(inv);
        if (balance <= 0) continue;
        const dpd = daysPastDue(inv.due_date, today);
        if (dpd <= 0) continue;
        const p = inv.people;
        const party_label = p
          ? p.company || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Tenant"
          : "Tenant";
        overdue.push({
          id: inv.id,
          number: inv.number,
          due_date: inv.due_date,
          balance,
          dpd,
          party_label,
        });
      }
      setRows(overdue);
      setLoading(false);
    })();
  }, [activeWorkspace?.id]);

  if (loading || rows.length === 0) return null;

  const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0);
  const worstDpd = Math.max(...rows.map((r) => r.dpd));
  const tone = worstDpd > 30 ? "danger" : worstDpd > 7 ? "warning" : "neutral";

  return (
    <>
      <Card
        className={cn(
          "p-5 border-l-4",
          tone === "danger" && "border-l-destructive bg-destructive/5",
          tone === "warning" && "border-l-gold bg-gold/5",
          tone === "neutral" && "border-l-architect bg-muted/30",
        )}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={cn(
              "h-5 w-5 shrink-0 mt-0.5",
              tone === "danger" ? "text-destructive" : tone === "warning" ? "text-gold" : "text-architect",
            )}
            strokeWidth={1.6}
          />
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <div className="font-display text-lg text-architect">
                {rows.length === 1 ? "Rent payment overdue" : `${rows.length} rent payments overdue`}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                AED {totalOutstanding.toLocaleString()} outstanding · oldest is {worstDpd} day{worstDpd === 1 ? "" : "s"} past due.
              </p>
            </div>

            <div className="border hairline rounded-sm divide-y hairline overflow-hidden bg-card">
              {rows.slice(0, 3).map((r) => (
                <div key={r.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="text-architect truncate">{r.party_label}</div>
                    <div className="mono text-[10px] text-muted-foreground">
                      {r.number} · due {new Date(r.due_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-architect">AED {r.balance.toLocaleString()}</div>
                    <div className="text-[10px] uppercase tracking-wider text-destructive">
                      {r.dpd}d late
                    </div>
                  </div>
                </div>
              ))}
              {rows.length > 3 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                  +{rows.length - 3} more
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setLegalOpen(true)}>
                <Scale className="h-3.5 w-3.5 mr-1.5" />
                See your legal options
              </Button>
              <Button size="sm" asChild>
                <Link to={servicesHref}>
                  Request legal help
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <LegalOptionsDialog open={legalOpen} onOpenChange={setLegalOpen} servicesHref={servicesHref} />
    </>
  );
}