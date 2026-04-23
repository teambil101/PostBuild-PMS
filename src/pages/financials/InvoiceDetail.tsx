import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Ban, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { BalanceBadge } from "@/components/financials/BalanceBadge";
import { RecordPaymentDialog } from "@/components/financials/RecordPaymentDialog";
import { invoiceBalance, daysPastDue, toNum } from "@/lib/financialFormulas";
import { INVOICE_STATUS_LABEL } from "@/lib/financials";

interface InvLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
}

interface Allocation {
  id: string;
  amount: number;
  payment: {
    id: string;
    number: string;
    paid_on: string;
    method: string;
    reference: string | null;
  } | null;
}

interface Inv {
  id: string;
  number: string;
  status: string;
  bill_to_role: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  contract_id: string | null;
  party_person_id: string | null;
  party: { id: string; first_name: string; last_name: string; company: string | null; primary_email: string | null } | null;
  contract: { id: string; contract_number: string; contract_type: string } | null;
  voided_at: string | null;
  voided_reason: string | null;
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inv, setInv] = useState<Inv | null>(null);
  const [lines, setLines] = useState<InvLine[]>([]);
  const [allocs, setAllocs] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    if (id) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: i }, { data: ls }, { data: al }] = await Promise.all([
      supabase
        .from("invoices")
        .select(`
          *,
          party:people!invoices_party_person_id_fkey(id, first_name, last_name, company, primary_email),
          contract:contracts(id, contract_number, contract_type)
        `)
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", id)
        .order("sort_order"),
      supabase
        .from("payment_allocations")
        .select("id, amount, payment:payments(id, number, paid_on, method, reference)")
        .eq("invoice_id", id),
    ]);
    setInv((i as any) ?? null);
    setLines((ls as any) ?? []);
    setAllocs((al as any) ?? []);
    setLoading(false);
  };

  const handleVoid = async () => {
    if (!inv) return;
    const reason = window.prompt("Reason for voiding this invoice?");
    if (!reason) return;
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "void" as any,
        voided_at: new Date().toISOString(),
        voided_reason: reason,
      })
      .eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invoice voided");
    await load();
  };

  if (loading) return <div className="text-sm text-muted-foreground py-12 text-center">Loading invoice…</div>;
  if (!inv) {
    return (
      <EmptyState
        icon={<FileText className="h-10 w-10" strokeWidth={1.2} />}
        title="Invoice not found"
        action={<Button onClick={() => navigate("/financials")}>Back to financials</Button>}
      />
    );
  }

  const balance = invoiceBalance(inv);
  const dpd = daysPastDue(inv.due_date);
  const isOverdue = balance > 0 && dpd > 0 && inv.status !== "void";
  const canPay = balance > 0 && inv.status !== "void" && inv.status !== "draft";

  return (
    <>
      <PageHeader
        eyebrow={`${inv.number} · ${inv.bill_to_role === "tenant" ? "Tenant invoice" : "Landlord invoice"}`}
        title={inv.contract ? `Invoice for ${inv.contract.contract_number}` : "Invoice"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/financials")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {canPay && (
              <Button onClick={() => setPayOpen(true)}>
                <CreditCard className="h-4 w-4" />
                Record payment
              </Button>
            )}
            {inv.status !== "void" && inv.status !== "paid" && (
              <Button variant="outline" onClick={handleVoid}>
                <Ban className="h-4 w-4" />
                Void
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 -mt-4">
        <BalanceBadge
          balance={balance}
          currency={inv.currency}
          earliestDueDate={inv.due_date}
          label={
            balance === 0 && inv.status === "paid"
              ? "Paid"
              : `${inv.currency} ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding`
          }
        />
        <span className="text-xs text-muted-foreground">
          <span className="mono uppercase tracking-wider">Status:</span>{" "}
          {isOverdue ? "Overdue" : INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
        </span>
        <span className="text-xs text-muted-foreground">
          <span className="mono uppercase tracking-wider">Issued:</span>{" "}
          {new Date(inv.issue_date).toLocaleDateString()}
        </span>
        <span className="text-xs text-muted-foreground">
          <span className="mono uppercase tracking-wider">Due:</span>{" "}
          {new Date(inv.due_date).toLocaleDateString()}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="border hairline rounded-sm bg-card overflow-hidden">
            <div className="table-scroll">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="border-b hairline bg-muted/30">
                <tr className="text-left">
                  <th className="px-4 py-2.5 label-eyebrow text-muted-foreground font-normal">Description</th>
                  <th className="px-4 py-2.5 label-eyebrow text-muted-foreground font-normal text-right">Qty</th>
                  <th className="px-4 py-2.5 label-eyebrow text-muted-foreground font-normal text-right">Unit price</th>
                  <th className="px-4 py-2.5 label-eyebrow text-muted-foreground font-normal text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b hairline last:border-0">
                    <td className="px-4 py-3 text-architect">{l.description}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(l.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/20">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-xs text-muted-foreground">Subtotal</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {Number(inv.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                {toNum(inv.tax) > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-xs text-muted-foreground">Tax</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Number(inv.tax).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                <tr className="border-t hairline">
                  <td colSpan={3} className="px-4 py-2.5 text-right font-medium">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-architect">
                    {inv.currency}{" "}
                    {Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>

          <div className="border hairline rounded-sm bg-card p-5">
            <div className="label-eyebrow text-muted-foreground mb-3">Payments</div>
            {allocs.length === 0 ? (
              <div className="text-xs text-muted-foreground">No payments recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {allocs.map((a) => (
                  <div key={a.id} className="flex items-center justify-between border-b hairline last:border-0 py-2 text-sm">
                    <div>
                      <div className="mono text-xs text-architect">{a.payment?.number ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.payment ? `${new Date(a.payment.paid_on).toLocaleDateString()} · ${a.payment.method.replace("_", " ")}` : ""}
                        {a.payment?.reference ? ` · ${a.payment.reference}` : ""}
                      </div>
                    </div>
                    <div className="tabular-nums text-architect">
                      {inv.currency} {Number(a.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {inv.notes && (
            <div className="border hairline rounded-sm bg-card p-5">
              <div className="label-eyebrow text-muted-foreground mb-2">Notes</div>
              <p className="text-sm text-architect whitespace-pre-wrap">{inv.notes}</p>
            </div>
          )}

          {inv.voided_at && (
            <div className="border hairline rounded-sm bg-red-50/50 dark:bg-red-950/20 p-5">
              <div className="label-eyebrow text-red-700 dark:text-red-300 mb-1">Voided</div>
              <p className="text-sm text-architect">{inv.voided_reason}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {new Date(inv.voided_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="border hairline rounded-sm bg-card p-5 space-y-3">
            <div>
              <div className="label-eyebrow text-muted-foreground mb-1">Bill to</div>
              {inv.party ? (
                <Link to={`/people/${inv.party.id}`} className="text-architect hover:underline">
                  {inv.party.first_name} {inv.party.last_name}
                  {inv.party.company ? ` · ${inv.party.company}` : ""}
                </Link>
              ) : (
                <span className="text-muted-foreground text-sm">Unassigned</span>
              )}
              {inv.party?.primary_email && (
                <div className="text-xs text-muted-foreground mt-0.5">{inv.party.primary_email}</div>
              )}
            </div>
            {inv.contract && (
              <div>
                <div className="label-eyebrow text-muted-foreground mb-1">Contract</div>
                <Link
                  to={`/contracts/${inv.contract.id}`}
                  className="mono text-xs text-architect hover:underline"
                >
                  {inv.contract.contract_number}
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>

      <RecordPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoices={[inv]}
        partyPersonId={inv.party_person_id}
        currency={inv.currency}
        onSaved={load}
      />
    </>
  );
}
