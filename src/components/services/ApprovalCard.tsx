import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, ShieldAlert, ShieldCheck, ShieldX, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_STYLES,
  type ServiceRequestApprovalStatus,
} from "@/lib/services";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  requestId: string;
  status: ServiceRequestApprovalStatus;
  reason: string | null;
  ruleSnapshot: string | null;
  thresholdAmount: number | null;
  thresholdCurrency: string | null;
  managementAgreementId: string | null;
  requestedAt: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  onChanged: () => void | Promise<void>;
}

export function ApprovalCard({
  requestId,
  status,
  reason,
  ruleSnapshot,
  thresholdAmount,
  thresholdCurrency,
  managementAgreementId,
  requestedAt,
  decidedAt,
  decisionNotes,
  onChanged,
}: Props) {
  const [notes, setNotes] = useState("");
  const [working, setWorking] = useState(false);

  const decide = async (decision: "approved" | "rejected") => {
    setWorking(true);
    const { error } = await supabase.rpc("decide_service_request_approval", {
      p_request_id: requestId,
      p_decision: decision,
      p_notes: notes.trim() || null,
    });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(decision === "approved" ? "Request approved" : "Request rejected");
    setNotes("");
    await onChanged();
  };

  const reset = async () => {
    setWorking(true);
    const { error } = await supabase.rpc("reset_service_request_approval", {
      p_request_id: requestId,
    });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Approval re-requested");
    await onChanged();
  };

  if (status === "not_required") return null;

  const Icon =
    status === "pending" ? ShieldAlert : status === "approved" ? ShieldCheck : ShieldX;

  const tone =
    status === "pending"
      ? "border-amber-500/40 bg-amber-500/5"
      : status === "approved"
        ? "border-status-occupied/40 bg-status-occupied/5"
        : "border-destructive/40 bg-destructive/5";

  return (
    <Card className={cn("hairline border-2", tone)}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start gap-3">
          <Icon
            className={cn(
              "h-5 w-5 mt-0.5 shrink-0",
              status === "pending" && "text-amber-700",
              status === "approved" && "text-status-occupied",
              status === "rejected" && "text-destructive",
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={APPROVAL_STATUS_STYLES[status]}>
                {APPROVAL_STATUS_LABEL[status]}
              </Badge>
              {ruleSnapshot && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  · Rule: {ruleSnapshot.replace(/_/g, " ")}
                </span>
              )}
              {thresholdAmount && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  · Threshold: {thresholdCurrency ?? "AED"}{" "}
                  {Number(thresholdAmount).toLocaleString()}
                </span>
              )}
            </div>
            {reason && (
              <p className="text-sm text-architect mt-2">{reason}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
              {requestedAt && (
                <span>Requested {format(new Date(requestedAt), "d MMM yyyy · HH:mm")}</span>
              )}
              {decidedAt && (
                <span>· Decided {format(new Date(decidedAt), "d MMM yyyy · HH:mm")}</span>
              )}
              {managementAgreementId && (
                <Link
                  to={`/contracts/${managementAgreementId}`}
                  className="underline hover:text-architect"
                >
                  · View management agreement
                </Link>
              )}
            </div>
            {decisionNotes && (
              <p className="text-sm text-architect mt-2 italic">
                "{decisionNotes}"
              </p>
            )}
          </div>
        </div>

        {status === "pending" && (
          <div className="space-y-2 pt-2 border-t hairline">
            <Textarea
              rows={2}
              placeholder="Decision notes (optional)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => decide("rejected")}
                disabled={working}
              >
                <ShieldX className="h-3.5 w-3.5" />
                Reject
              </Button>
              <Button size="sm" onClick={() => decide("approved")} disabled={working}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </Button>
            </div>
          </div>
        )}

        {(status === "approved" || status === "rejected") && (
          <div className="flex justify-end pt-2 border-t hairline">
            <Button size="sm" variant="ghost" onClick={reset} disabled={working}>
              <RotateCcw className="h-3.5 w-3.5" />
              Re-request approval
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}