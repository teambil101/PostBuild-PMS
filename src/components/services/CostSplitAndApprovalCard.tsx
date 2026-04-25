import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Coins,
  Loader2,
  MessageCircle,
  X,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  BILL_TO_MODE_LABEL,
  PARTY_APPROVAL_LABEL,
  PARTY_APPROVAL_STYLES,
  type BillToMode,
  type PartyCostApprovalStatus,
} from "@/lib/vendor-services";
import { cn } from "@/lib/utils";

interface SplitProposal {
  id: string;
  proposed_by_role: string;
  landlord_share_percent: number;
  tenant_share_percent: number;
  message: string | null;
  status: "proposed" | "accepted" | "rejected" | "countered" | "superseded";
  created_at: string;
  decided_at: string | null;
}

interface Props {
  requestId: string;
  billToMode: BillToMode;
  landlordSharePercent: number;
  tenantSharePercent: number;
  winningQuoteId: string | null;
  winningQuoteAmount: number | null;
  winningQuoteCurrency: string | null;
  winningVendorName: string | null;
  landlordCostApprovalStatus: PartyCostApprovalStatus;
  tenantCostApprovalStatus: PartyCostApprovalStatus;
  landlordCostApprovedAt: string | null;
  tenantCostApprovedAt: string | null;
  onChanged: () => void | Promise<void>;
}

export function CostSplitAndApprovalCard({
  requestId,
  billToMode,
  landlordSharePercent,
  tenantSharePercent,
  winningQuoteId,
  winningQuoteAmount,
  winningQuoteCurrency,
  winningVendorName,
  landlordCostApprovalStatus,
  tenantCostApprovalStatus,
  landlordCostApprovedAt,
  tenantCostApprovedAt,
  onChanged,
}: Props) {
  const [proposals, setProposals] = useState<SplitProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [landlordPct, setLandlordPct] = useState<number>(landlordSharePercent);
  const [message, setMessage] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_request_cost_split")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });
    setProposals((data ?? []) as SplitProposal[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [requestId]);

  const propose = async () => {
    setWorking(true);
    const { error } = await supabase.rpc("propose_cost_split", {
      p_request_id: requestId,
      p_role: "staff",
      p_landlord_share_percent: landlordPct,
      p_tenant_share_percent: 100 - landlordPct,
      p_message: message.trim() || null,
      p_proposed_by_person_id: null,
    });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProposeOpen(false);
    setMessage("");
    toast.success("Split proposal posted");
    await load();
    await onChanged();
  };

  const acceptProposal = async (proposalId: string) => {
    setWorking(true);
    const { error } = await supabase.rpc("accept_cost_split", {
      p_proposal_id: proposalId,
      p_role: "staff",
    });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Split locked in");
    await load();
    await onChanged();
  };

  const respondQuote = async (role: "landlord" | "tenant", decision: "approved" | "rejected") => {
    setWorking(true);
    const { error } = await supabase.rpc("respond_winning_quote", {
      p_request_id: requestId,
      p_role: role,
      p_decision: decision,
      p_notes: null,
    });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${role === "landlord" ? "Landlord" : "Tenant"} ${decision}`);
    await onChanged();
  };

  const showNegotiationThread = billToMode === "to_be_negotiated";
  const landlordOwes = Number(landlordSharePercent) > 0;
  const tenantOwes = Number(tenantSharePercent) > 0;
  const showWinnerApprovals = winningQuoteId != null;

  return (
    <Card className="hairline">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Coins className="h-4 w-4 text-muted-foreground" />
          Cost responsibility & approval
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {BILL_TO_MODE_LABEL[billToMode]}
          {(billToMode === "split" || billToMode === "to_be_negotiated") && (
            <span className="mono tabular-nums ml-2">
              · landlord {landlordSharePercent}% / tenant {tenantSharePercent}%
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ---- Negotiation thread ---- */}
        {showNegotiationThread && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-architect">
                Split negotiation
              </div>
              <Button size="sm" variant="outline" onClick={() => setProposeOpen((v) => !v)}>
                <MessageCircle className="h-3.5 w-3.5" />
                Propose split
              </Button>
            </div>

            {proposeOpen && (
              <div className="border hairline rounded-sm p-3 bg-muted/20 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Landlord share
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[landlordPct]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={(v) => setLandlordPct(v[0])}
                      className="flex-1"
                    />
                    <span className="mono tabular-nums text-xs text-architect w-24 text-right">
                      {landlordPct}% / {100 - landlordPct}%
                    </span>
                  </div>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Why this split? (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setProposeOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={propose} disabled={working}>
                    {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <Send className="h-3.5 w-3.5" />
                    Send proposal
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="py-4 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">
                No proposals yet. Post one to start the back-and-forth.
              </div>
            ) : (
              <div className="space-y-1.5">
                {proposals.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "border hairline rounded-sm p-2.5 text-xs",
                      p.status === "accepted" && "bg-status-occupied/5 border-status-occupied/40",
                      p.status === "superseded" && "opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          {p.proposed_by_role}
                        </Badge>
                        <span className="mono tabular-nums text-architect">
                          {p.landlord_share_percent}% / {p.tenant_share_percent}%
                        </span>
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                        </span>
                        {p.status !== "proposed" && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            {p.status}
                          </Badge>
                        )}
                      </div>
                      {p.status === "proposed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acceptProposal(p.id)}
                          disabled={working}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Accept
                        </Button>
                      )}
                    </div>
                    {p.message && (
                      <div className="mt-1.5 text-architect whitespace-pre-wrap">{p.message}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- Winner cost approvals ---- */}
        {showWinnerApprovals && (
          <div className="space-y-2 border-t hairline pt-3">
            <div className="text-[11px] uppercase tracking-wider text-architect">
              Winning quote · cost approval
            </div>
            <div className="border hairline rounded-sm p-3 bg-muted/20 space-y-1">
              <div className="text-sm text-architect">{winningVendorName ?? "Vendor"}</div>
              <div className="mono tabular-nums text-architect">
                {winningQuoteAmount != null
                  ? `${winningQuoteCurrency ?? "AED"} ${Number(winningQuoteAmount).toLocaleString()}`
                  : "Amount pending"}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ApprovalRow
                label={`Landlord (${landlordSharePercent}%)`}
                amount={
                  winningQuoteAmount != null
                    ? Number(winningQuoteAmount) * (Number(landlordSharePercent) / 100)
                    : null
                }
                currency={winningQuoteCurrency ?? "AED"}
                status={landlordCostApprovalStatus}
                decidedAt={landlordCostApprovedAt}
                disabled={!landlordOwes || working}
                onApprove={() => respondQuote("landlord", "approved")}
                onReject={() => respondQuote("landlord", "rejected")}
              />
              <ApprovalRow
                label={`Tenant (${tenantSharePercent}%)`}
                amount={
                  winningQuoteAmount != null
                    ? Number(winningQuoteAmount) * (Number(tenantSharePercent) / 100)
                    : null
                }
                currency={winningQuoteCurrency ?? "AED"}
                status={tenantCostApprovalStatus}
                decidedAt={tenantCostApprovedAt}
                disabled={!tenantOwes || working}
                onApprove={() => respondQuote("tenant", "approved")}
                onReject={() => respondQuote("tenant", "rejected")}
              />
            </div>
          </div>
        )}

        {!showNegotiationThread && !showWinnerApprovals && (
          <p className="text-xs text-muted-foreground italic">
            Pick a winning quote to start the cost-approval flow.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ApprovalRow({
  label,
  amount,
  currency,
  status,
  decidedAt,
  disabled,
  onApprove,
  onReject,
}: {
  label: string;
  amount: number | null;
  currency: string;
  status: PartyCostApprovalStatus;
  decidedAt: string | null;
  disabled?: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="border hairline rounded-sm p-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-architect font-medium">{label}</span>
        <Badge
          variant="outline"
          className={cn("text-[10px] uppercase tracking-wider", PARTY_APPROVAL_STYLES[status])}
        >
          {PARTY_APPROVAL_LABEL[status]}
        </Badge>
      </div>
      {amount != null && (
        <div className="mono tabular-nums text-xs text-muted-foreground mt-1">
          {currency} {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      )}
      {decidedAt && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {format(new Date(decidedAt), "d MMM HH:mm")}
        </div>
      )}
      {status === "pending" && !disabled && (
        <div className="flex gap-1.5 mt-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onApprove}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approve
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}