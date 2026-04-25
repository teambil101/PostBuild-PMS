import { useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Send,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";
type ScheduleStatus = "none" | "proposed" | "confirmed" | "rescheduled";

interface Props {
  requestId: string;
  tenantToken: string | null;

  approvalRequired: boolean;
  approvalStatus: ApprovalStatus;
  approvalReason: string | null;
  approvalRequestedAt: string | null;
  approvalDecidedAt: string | null;
  approvalNotes: string | null;

  proposedScheduledDate: string | null;
  scheduleStatus: ScheduleStatus;
  tenantProposedDate: string | null;
  scheduleNotes: string | null;
  counterRound: number;
  scheduledDate: string | null;

  billing: string;
  billTo: string;
  costEstimate: number | null;
  currency: string;

  onChanged: () => void | Promise<void>;
}

const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  not_required: "Not required",
  pending: "Awaiting tenant",
  approved: "Approved by tenant",
  rejected: "Rejected by tenant",
};

const APPROVAL_STYLES: Record<ApprovalStatus, string> = {
  not_required: "bg-muted text-muted-foreground border-warm-stone/60",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  approved: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

const SCHEDULE_LABEL: Record<ScheduleStatus, string> = {
  none: "Not proposed",
  proposed: "Awaiting tenant confirmation",
  confirmed: "Confirmed by tenant",
  rescheduled: "Tenant counter-proposed",
};

const SCHEDULE_STYLES: Record<ScheduleStatus, string> = {
  none: "bg-muted text-muted-foreground border-warm-stone/60",
  proposed: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  confirmed: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
  rescheduled: "bg-blue-500/10 text-blue-700 border-blue-500/30",
};

export function TenantCoordinationCard(props: Props) {
  const [requestApprovalOpen, setRequestApprovalOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [acceptCounterWorking, setAcceptCounterWorking] = useState(false);

  const {
    requestId,
    tenantToken,
    approvalRequired,
    approvalStatus,
    approvalReason,
    approvalRequestedAt,
    approvalDecidedAt,
    approvalNotes,
    proposedScheduledDate,
    scheduleStatus,
    tenantProposedDate,
    scheduleNotes,
    counterRound,
    scheduledDate,
    billing,
    billTo,
    costEstimate,
    onChanged,
  } = props;

  const copyTenantLink = () => {
    if (!tenantToken) {
      toast.error("No tenant link available yet");
      return;
    }
    const url = `${window.location.origin}/t/${tenantToken}`;
    void navigator.clipboard.writeText(url);
    toast.success("Tenant link copied");
  };

  const acceptTenantCounter = async () => {
    if (!tenantProposedDate) return;
    setAcceptCounterWorking(true);
    const { error } = await supabase
      .from("service_requests")
      .update({
        scheduled_date: tenantProposedDate,
        proposed_scheduled_date: tenantProposedDate,
        tenant_schedule_status: "confirmed",
        tenant_schedule_decided_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (error) {
      toast.error(error.message);
      setAcceptCounterWorking(false);
      return;
    }
    await supabase.from("service_request_events").insert({
      request_id: requestId,
      event_type: "tenant_counter_accepted",
      description: "Staff accepted tenant counter-proposed date",
      to_value: tenantProposedDate,
    });
    setAcceptCounterWorking(false);
    toast.success("Tenant's date confirmed");
    await onChanged();
  };

  // Whether to suggest enabling tenant approval (heuristic)
  const suggestApproval =
    !approvalRequired &&
    billing === "paid" &&
    billTo === "tenant" &&
    (costEstimate ?? 0) > 500;

  const showCard =
    approvalRequired ||
    suggestApproval ||
    scheduleStatus !== "none" ||
    !!proposedScheduledDate ||
    approvalStatus !== "not_required";

  if (!showCard) {
    // Always render — staff might want to manually trigger approval/schedule
    return (
      <Card className="hairline">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            Tenant coordination
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Optional — request tenant approval or propose a schedule.
          </p>
        </CardHeader>
        <CardContent className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setRequestApprovalOpen(true)}>
            <ShieldAlert className="h-3.5 w-3.5" />
            Request tenant approval
          </Button>
          <Button size="sm" variant="outline" onClick={() => setProposeOpen(true)}>
            <CalendarDays className="h-3.5 w-3.5" />
            Propose schedule
          </Button>
        </CardContent>
        <RequestApprovalDialog
          open={requestApprovalOpen}
          onOpenChange={setRequestApprovalOpen}
          requestId={requestId}
          defaultReason={
            billing === "paid" && billTo === "tenant"
              ? "Cost will be billed to tenant — approval required."
              : ""
          }
          onDone={onChanged}
        />
        <ProposeScheduleDialog
          open={proposeOpen}
          onOpenChange={setProposeOpen}
          requestId={requestId}
          defaultDate={scheduledDate ?? null}
          onDone={onChanged}
        />
      </Card>
    );
  }

  return (
    <Card className="hairline">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              Tenant coordination
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Approvals and scheduling confirmed by the tenant via a public link.
            </p>
          </div>
          {tenantToken && (
            <Button size="sm" variant="ghost" onClick={copyTenantLink}>
              <Copy className="h-3.5 w-3.5" />
              Copy tenant link
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestApproval && (
          <div className="text-xs bg-amber-500/5 border border-amber-500/30 rounded-sm px-3 py-2 text-amber-800 flex items-start gap-2">
            <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="flex-1">
              This job will be billed to the tenant for over 500 AED — consider requesting tenant approval first.
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => setRequestApprovalOpen(true)}
            >
              Request now
            </Button>
          </div>
        )}

        {/* Approval row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Tenant approval
              </span>
              <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", APPROVAL_STYLES[approvalStatus])}>
                {APPROVAL_LABEL[approvalStatus]}
              </Badge>
            </div>
            {approvalReason && (
              <p className="text-sm text-architect mt-1">{approvalReason}</p>
            )}
            <div className="text-[11px] text-muted-foreground mt-0.5 space-x-3">
              {approvalRequestedAt && (
                <span>Requested {format(new Date(approvalRequestedAt), "d MMM HH:mm")}</span>
              )}
              {approvalDecidedAt && (
                <span>Decided {format(new Date(approvalDecidedAt), "d MMM HH:mm")}</span>
              )}
            </div>
            {approvalNotes && (
              <div className="text-xs bg-muted/30 rounded px-2 py-1.5 mt-2 whitespace-pre-wrap text-architect">
                "{approvalNotes}"
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {approvalStatus === "not_required" && (
              <Button size="sm" variant="outline" onClick={() => setRequestApprovalOpen(true)}>
                <ShieldAlert className="h-3.5 w-3.5" />
                Request approval
              </Button>
            )}
            {approvalStatus === "rejected" && (
              <Button size="sm" variant="outline" onClick={() => setRequestApprovalOpen(true)}>
                Re-request
              </Button>
            )}
            {approvalStatus === "approved" && (
              <ShieldCheck className="h-4 w-4 text-status-occupied" />
            )}
            {approvalStatus === "rejected" && (
              <ShieldX className="h-4 w-4 text-destructive" />
            )}
          </div>
        </div>

        <div className="border-t hairline" />

        {/* Schedule row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Schedule confirmation
              </span>
              <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", SCHEDULE_STYLES[scheduleStatus])}>
                {SCHEDULE_LABEL[scheduleStatus]}
              </Badge>
              {counterRound > 0 && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  · round {counterRound}/2
                </span>
              )}
            </div>
            <div className="text-sm text-architect mt-1 space-y-0.5">
              {proposedScheduledDate && (
                <div>
                  Proposed:{" "}
                  <span className="mono tabular-nums">
                    {format(new Date(proposedScheduledDate), "EEE d MMM yyyy")}
                  </span>
                </div>
              )}
              {tenantProposedDate && (
                <div>
                  Tenant counter:{" "}
                  <span className="mono tabular-nums text-blue-700">
                    {format(new Date(tenantProposedDate), "EEE d MMM yyyy")}
                  </span>
                </div>
              )}
              {scheduledDate && scheduleStatus === "confirmed" && (
                <div>
                  Confirmed:{" "}
                  <span className="mono tabular-nums text-status-occupied">
                    {format(new Date(scheduledDate), "EEE d MMM yyyy")}
                  </span>
                </div>
              )}
            </div>
            {scheduleNotes && (
              <div className="text-xs bg-muted/30 rounded px-2 py-1.5 mt-2 whitespace-pre-wrap text-architect">
                "{scheduleNotes}"
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {scheduleStatus === "rescheduled" && tenantProposedDate && (
              <Button
                size="sm"
                onClick={acceptTenantCounter}
                disabled={acceptCounterWorking}
              >
                {acceptCounterWorking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Accept tenant's date
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setProposeOpen(true)}>
              <CalendarDays className="h-3.5 w-3.5" />
              {scheduleStatus === "none" ? "Propose schedule" : "Re-propose"}
            </Button>
          </div>
        </div>
      </CardContent>

      <RequestApprovalDialog
        open={requestApprovalOpen}
        onOpenChange={setRequestApprovalOpen}
        requestId={requestId}
        defaultReason={approvalReason ?? ""}
        onDone={onChanged}
      />
      <ProposeScheduleDialog
        open={proposeOpen}
        onOpenChange={setProposeOpen}
        requestId={requestId}
        defaultDate={proposedScheduledDate ?? scheduledDate ?? null}
        onDone={onChanged}
      />
    </Card>
  );
}

/* ============== Dialogs ============== */

function RequestApprovalDialog({
  open,
  onOpenChange,
  requestId,
  defaultReason,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: string;
  defaultReason: string;
  onDone: () => void | Promise<void>;
}) {
  const [reason, setReason] = useState(defaultReason);
  const [working, setWorking] = useState(false);

  const submit = async () => {
    setWorking(true);
    const { error } = await supabase.rpc("request_tenant_approval", {
      p_request_id: requestId,
      p_reason: reason.trim() || null,
    });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tenant approval requested — share the tenant link");
    onOpenChange(false);
    await onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request tenant approval</DialogTitle>
          <DialogDescription>
            The tenant will be asked to approve or reject via a public link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason" className="text-xs">
            Reason / context for the tenant
          </Label>
          <Textarea
            id="reason"
            rows={4}
            placeholder="e.g. Cost will be billed to you, please confirm…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={working}>
            <XCircle className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button onClick={submit} disabled={working}>
            {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProposeScheduleDialog({
  open,
  onOpenChange,
  requestId,
  defaultDate,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: string;
  defaultDate: string | null;
  onDone: () => void | Promise<void>;
}) {
  const [date, setDate] = useState(defaultDate ?? "");
  const [notes, setNotes] = useState("");
  const [working, setWorking] = useState(false);

  const submit = async () => {
    if (!date) {
      toast.error("Pick a date");
      return;
    }
    setWorking(true);
    const { error } = await supabase.rpc("propose_tenant_schedule", {
      p_request_id: requestId,
      p_date: date,
      p_notes: notes.trim() || null,
    });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Schedule proposed — share the tenant link");
    onOpenChange(false);
    await onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Propose schedule to tenant</DialogTitle>
          <DialogDescription>
            The tenant will see this date and can confirm or counter-propose.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="date" className="text-xs">
              Proposed date
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="notes" className="text-xs">
              Note for the tenant (optional)
            </Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="e.g. Vendor available between 9am–12pm…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={working}>
            <XCircle className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button onClick={submit} disabled={working}>
            {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Propose
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}