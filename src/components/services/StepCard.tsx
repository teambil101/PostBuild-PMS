import { useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  SkipForward,
  Wrench,
  User as UserIcon,
  CalendarDays,
  Coins,
  RotateCcw,
  Settings2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_STYLES,
  BILLING_LABEL,
  STEP_STATUS_LABEL,
  type ServiceBilling,
  type ServiceCategory,
  type ServiceDelivery,
  type ServiceRequestApprovalStatus,
  type ServiceRequestStepStatus,
} from "@/lib/services";
import { cn } from "@/lib/utils";
import { CategoryBadge, DeliveryBadge, BillingBadge } from "./CatalogBadges";
import { VendorPicker, type PickedVendor } from "@/components/contracts/VendorPicker";
import { PersonCombobox } from "@/components/owners/PersonCombobox";

export interface WorkflowStepRow {
  id: string;
  request_id: string;
  step_key: string;
  title: string;
  sort_order: number;
  category: ServiceCategory;
  delivery: ServiceDelivery;
  billing: ServiceBilling;
  blocks_next: boolean;
  status: ServiceRequestStepStatus;
  completed_at: string | null;
  notes: string | null;
  scheduled_date: string | null;
  assigned_vendor_id: string | null;
  assigned_person_id: string | null;
  cost_estimate: number | null;
  cost_final: number | null;
  approval_status: ServiceRequestApprovalStatus;
  approval_required_reason: string | null;
  approval_threshold_amount: number | null;
  approval_threshold_currency: string | null;
  approval_rule_snapshot: string | null;
  approval_decision_notes: string | null;
}

interface Props {
  step: WorkflowStepRow;
  index: number;
  total: number;
  /** Earlier `blocks_next` step is not yet complete — completion of this step is gated. */
  gatedByPredecessor: boolean;
  predecessorTitle?: string;
  vendorLabel?: string | null;
  personLabel?: string | null;
  onChanged: () => void | Promise<void>;
  onMove: (direction: "up" | "down") => void;
}

export function StepCard({
  step,
  index,
  total,
  gatedByPredecessor,
  predecessorTitle,
  vendorLabel,
  personLabel,
  onChanged,
  onMove,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const [costEdit, setCostEdit] = useState<string>(step.cost_estimate?.toString() ?? "");
  const [scheduledEdit, setScheduledEdit] = useState<string>(step.scheduled_date ?? "");
  const [billingEdit, setBillingEdit] = useState<ServiceBilling>(step.billing);
  const [decisionNotes, setDecisionNotes] = useState("");

  const done = step.status === "completed";
  const skipped = step.status === "skipped";
  const blockedByApproval =
    step.approval_status === "pending" || step.approval_status === "rejected";
  const completionBlocked = !done && !skipped && (gatedByPredecessor || blockedByApproval);

  const completionBlockReason = gatedByPredecessor
    ? `Complete "${predecessorTitle}" first (blocks next)`
    : step.approval_status === "pending"
      ? "Awaiting landlord approval"
      : step.approval_status === "rejected"
        ? "Approval was rejected — re-request to proceed"
        : "";

  const toggleComplete = async () => {
    if (completionBlocked) {
      toast.error(completionBlockReason);
      return;
    }
    setWorking(true);
    const newStatus: ServiceRequestStepStatus = done ? "pending" : "completed";
    const updates: any = {
      status: newStatus,
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("service_request_steps").update(updates).eq("id", step.id);
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from("service_request_events").insert({
      request_id: step.request_id,
      step_id: step.id,
      event_type: "step_status_change",
      from_value: step.status,
      to_value: newStatus,
    });
    await onChanged();
  };

  const skip = async () => {
    setWorking(true);
    const { error } = await supabase
      .from("service_request_steps")
      .update({ status: "skipped" })
      .eq("id", step.id);
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Step skipped");
    await onChanged();
  };

  const saveEdits = async () => {
    setWorking(true);
    const updates: any = {
      billing: billingEdit,
      scheduled_date: scheduledEdit || null,
      cost_estimate: billingEdit === "paid" && costEdit ? Number(costEdit) : null,
    };
    const { error } = await supabase.from("service_request_steps").update(updates).eq("id", step.id);
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Step updated");
    setEditing(false);
    await onChanged();
  };

  const assignVendor = async (v: PickedVendor | null) => {
    setWorking(true);
    const { error } = await supabase
      .from("service_request_steps")
      .update({ assigned_vendor_id: v?.id ?? null, assigned_person_id: null })
      .eq("id", step.id);
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    await onChanged();
  };

  const assignPerson = async (personId: string | null) => {
    setWorking(true);
    const { error } = await supabase
      .from("service_request_steps")
      .update({ assigned_person_id: personId, assigned_vendor_id: null })
      .eq("id", step.id);
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    await onChanged();
  };

  const decideApproval = async (decision: "approved" | "rejected") => {
    setWorking(true);
    const { error } = await supabase.rpc("decide_service_request_step_approval", {
      p_step_id: step.id,
      p_decision: decision,
      p_notes: decisionNotes.trim() || null,
    });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success(decision === "approved" ? "Step approved" : "Step rejected");
    setDecisionNotes("");
    await onChanged();
  };

  const resetApproval = async () => {
    setWorking(true);
    const { error } = await supabase.rpc("reset_service_request_step_approval", {
      p_step_id: step.id,
    });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Approval re-requested");
    await onChanged();
  };

  const ApprovalIcon =
    step.approval_status === "approved" ? ShieldCheck
    : step.approval_status === "rejected" ? ShieldX
    : ShieldAlert;

  return (
    <div
      className={cn(
        "px-4 py-3 transition-colors",
        skipped && "opacity-50",
        gatedByPredecessor && !done && "bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Reorder arrows */}
        <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={index === 0 || working}
            className="text-muted-foreground hover:text-architect disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={index === total - 1 || working}
            className="text-muted-foreground hover:text-architect disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Complete toggle */}
        <button
          type="button"
          onClick={toggleComplete}
          className="mt-0.5 shrink-0"
          disabled={skipped || working}
          title={completionBlockReason}
        >
          {done ? (
            <CheckCircle2 className="h-5 w-5 text-status-occupied" />
          ) : completionBlocked ? (
            <Lock className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground hover:text-architect transition-colors" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-sm",
                done && "text-muted-foreground line-through",
                !done && "text-architect",
              )}
            >
              {index + 1}. {step.title}
            </span>
            {step.blocks_next && !done && (
              <Badge variant="outline" className="text-[9px]">Blocks next</Badge>
            )}
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              · {STEP_STATUS_LABEL[step.status]}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <CategoryBadge value={step.category} />
            <DeliveryBadge value={step.delivery} />
            <BillingBadge value={step.billing} />
            {step.completed_at && (
              <span className="text-[10px] text-muted-foreground">
                · Done {format(new Date(step.completed_at), "d MMM")}
              </span>
            )}
            {step.scheduled_date && (
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                · <CalendarDays className="h-3 w-3" />
                {format(new Date(step.scheduled_date), "d MMM yyyy")}
              </span>
            )}
            {step.cost_estimate != null && (
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                · <Coins className="h-3 w-3" />
                AED {Number(step.cost_estimate).toLocaleString()}
              </span>
            )}
          </div>

          {/* Assignment row */}
          {(vendorLabel || personLabel) && (
            <div className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              {vendorLabel ? <Wrench className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
              Assigned to {vendorLabel ?? personLabel}
            </div>
          )}

          {/* Approval banner */}
          {step.approval_status !== "not_required" && (
            <div
              className={cn(
                "mt-2 border hairline rounded-sm px-2.5 py-2 flex items-start gap-2",
                step.approval_status === "pending" && "border-amber-500/40 bg-amber-500/5",
                step.approval_status === "approved" && "border-status-occupied/40 bg-status-occupied/5",
                step.approval_status === "rejected" && "border-destructive/40 bg-destructive/5",
              )}
            >
              <ApprovalIcon
                className={cn(
                  "h-3.5 w-3.5 mt-0.5 shrink-0",
                  step.approval_status === "pending" && "text-amber-700",
                  step.approval_status === "approved" && "text-status-occupied",
                  step.approval_status === "rejected" && "text-destructive",
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className={cn("text-[9px]", APPROVAL_STATUS_STYLES[step.approval_status])}>
                    {APPROVAL_STATUS_LABEL[step.approval_status]}
                  </Badge>
                  {step.approval_rule_snapshot && (
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      {step.approval_rule_snapshot.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                {step.approval_required_reason && (
                  <p className="text-[11px] text-architect mt-1">{step.approval_required_reason}</p>
                )}
                {step.approval_decision_notes && (
                  <p className="text-[11px] text-architect italic mt-1">"{step.approval_decision_notes}"</p>
                )}

                {step.approval_status === "pending" && (
                  <div className="mt-2 space-y-1.5">
                    <Textarea
                      rows={1}
                      placeholder="Decision notes (optional)…"
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      className="text-xs"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => decideApproval("rejected")} disabled={working}>
                        <ShieldX className="h-3 w-3" />
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => decideApproval("approved")} disabled={working}>
                        <ShieldCheck className="h-3 w-3" />
                        Approve
                      </Button>
                    </div>
                  </div>
                )}

                {(step.approval_status === "approved" || step.approval_status === "rejected") && (
                  <div className="mt-1.5 flex justify-end">
                    <Button size="sm" variant="ghost" onClick={resetApproval} disabled={working}>
                      <RotateCcw className="h-3 w-3" />
                      Re-request
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Edit panel */}
          <Collapsible open={editing} onOpenChange={setEditing}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-1 mt-1.5 text-[10px] text-muted-foreground">
                <Settings2 className="h-3 w-3" />
                {editing ? "Hide details" : "Edit step"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 border-t hairline pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Scheduled</Label>
                  <Input
                    type="date"
                    value={scheduledEdit}
                    onChange={(e) => setScheduledEdit(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Billing</Label>
                  <Select value={billingEdit} onValueChange={(v) => setBillingEdit(v as ServiceBilling)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BILLING_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {billingEdit === "paid" && (
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Cost estimate (AED)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={costEdit}
                    onChange={(e) => setCostEdit(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="—"
                  />
                </div>
              )}

              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Assign to
                </Label>
                {step.delivery === "vendor" || step.delivery === "either" ? (
                  <VendorPicker
                    value={
                      step.assigned_vendor_id
                        ? ({ id: step.assigned_vendor_id, vendor_number: "", legal_name: vendorLabel ?? "Vendor", display_name: null, vendor_type: "", status: "active", primary_email: null, primary_phone: null, default_call_out_fee: null, default_hourly_rate: null, currency: "AED" } as PickedVendor)
                        : null
                    }
                    onChange={assignVendor}
                  />
                ) : (
                  <PersonCombobox
                    value={step.assigned_person_id ?? ""}
                    valueLabel={personLabel ?? undefined}
                    onChange={(p) => assignPerson(p.id)}
                    placeholder="Pick staff member…"
                    roleFilter={["staff"]}
                    hideAddNew
                  />
                )}
              </div>

              <div className="flex justify-end gap-1.5 pt-1">
                {!done && !skipped && (
                  <Button size="sm" variant="ghost" onClick={skip} disabled={working}>
                    <SkipForward className="h-3 w-3" />
                    Skip
                  </Button>
                )}
                <Button size="sm" onClick={saveEdits} disabled={working}>
                  Save
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {done && (
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleComplete}
            className="shrink-0 text-muted-foreground"
            disabled={working}
          >
            Undo
          </Button>
        )}
      </div>
    </div>
  );
}