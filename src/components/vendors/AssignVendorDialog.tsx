import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Info, FileWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VendorPicker, type PickedVendor } from "./VendorPicker";
import { maintenanceTypeToSpecialty, complianceState, vendorDisplayName } from "@/lib/vendors";
import { ServiceAgreementWizard } from "@/components/contracts/service/ServiceAgreementWizard";
import {
  initializeTicketWorkflow,
  WORKFLOWS,
  type WorkflowKey,
} from "@/lib/workflows";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  ticketType: string;
  currentVendorId: string | null;
  currentVendorLabel?: string | null;
  currentWorkflowKey: WorkflowKey | null;
  costApprovalStatus: string | null;
  onDone: () => void;
}

/**
 * Assign / change / remove vendor on a ticket.
 *
 * Auto-init rule: if assigning a vendor AND ticket has no workflow yet,
 * the Vendor Dispatch workflow is initialized. Existing workflows are NEVER
 * replaced. The DB cost-approval sync trigger handles the landlord-approval
 * step state independently — but if we just initialized the workflow with
 * cost_approval_status already set to 'not_required', the trigger won't fire,
 * so we skip that step here too for parity.
 */
export function AssignVendorDialog({
  open,
  onOpenChange,
  ticketId,
  ticketType,
  currentVendorId,
  currentVendorLabel,
  currentWorkflowKey,
  costApprovalStatus,
  onDone,
}: Props) {
  const { user } = useAuth();
  const [picked, setPicked] = useState<PickedVendor | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const specialty = useMemo(() => maintenanceTypeToSpecialty(ticketType), [ticketType]);
  const isChange = Boolean(currentVendorId);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setNote("");
  }, [open]);

  const newVendorId = picked?.id ?? null;
  const willRemove = isChange && picked === null && note === ""; // only true if user opens, sets nothing
  // The picker emits null explicitly via the "Remove" item — track via a separate state.
  const [removeRequested, setRemoveRequested] = useState(false);
  useEffect(() => {
    if (!open) setRemoveRequested(false);
  }, [open]);

  // Compliance warnings about the picked vendor.
  const tlExpired = picked && complianceState(picked.trade_license_expiry_date) === "expired";
  const insExpired = picked && complianceState(picked.insurance_expiry_date) === "expired";

  const willInitWorkflow =
    !currentWorkflowKey && (newVendorId !== null);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const targetVendorId = removeRequested ? null : newVendorId;

      if (!removeRequested && !targetVendorId) {
        toast.error("Pick a vendor or choose remove.");
        setBusy(false);
        return;
      }

      // 1. Update vendor_id on ticket. Trigger logs the event.
      const { error: upErr } = await supabase
        .from("tickets")
        .update({ vendor_id: targetVendorId })
        .eq("id", ticketId);
      if (upErr) throw upErr;

      // 2. Auto-init workflow on first vendor assignment.
      if (targetVendorId && !currentWorkflowKey) {
        try {
          await initializeTicketWorkflow(ticketId, "vendor_dispatch");

          // 3. Auto-skip landlord approval step when cost is below threshold.
          // The DB trigger only fires on cost_approval_status CHANGES; since the
          // workflow was just created, no transition will fire it. Mirror the
          // logic here for parity with the trigger.
          if (costApprovalStatus === "not_required") {
            await supabase
              .from("ticket_workflow_steps")
              .update({
                status: "skipped",
                completed_at: new Date().toISOString(),
                completed_by: user?.id ?? null,
                note: "Auto-skipped: cost below threshold",
              })
              .eq("ticket_id", ticketId)
              .eq("step_key", "vendor_quote_landlord_approval")
              .eq("status", "pending");
          } else if (costApprovalStatus === "approved") {
            await supabase
              .from("ticket_workflow_steps")
              .update({
                status: "complete",
                completed_at: new Date().toISOString(),
                completed_by: user?.id ?? null,
                note: "Auto-completed via cost approval",
              })
              .eq("ticket_id", ticketId)
              .eq("step_key", "vendor_quote_landlord_approval")
              .eq("status", "pending");
          }
        } catch (wfErr: any) {
          toast.error(
            `Vendor assigned but workflow could not be initialized: ${wfErr.message ?? "unknown"}.`,
          );
        }
      }

      // 4. Optional note.
      if (note.trim()) {
        await supabase.from("notes").insert({
          entity_type: "ticket",
          entity_id: ticketId,
          body: note.trim(),
          author_id: user?.id ?? null,
        });
      }

      toast.success(
        removeRequested
          ? "Vendor removed."
          : isChange
            ? "Vendor changed."
            : "Vendor assigned.",
      );
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not update vendor.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isChange ? "Change vendor" : "Assign vendor"}</DialogTitle>
          <DialogDescription>
            {isChange
              ? "Replace the vendor handling this ticket, or remove the assignment."
              : "Link an external vendor to this ticket."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isChange && currentVendorLabel && (
            <div className="text-xs border hairline rounded-sm bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">Current: </span>
              <span className="text-architect">{currentVendorLabel}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Vendor {!removeRequested && <span className="text-destructive">*</span>}</Label>
            <VendorPicker
              value={removeRequested ? null : picked?.id ?? null}
              onChange={(v) => {
                setPicked(v);
                setRemoveRequested(v === null && isChange);
              }}
              filterSpecialty={specialty}
              allowClear={isChange}
            />
          </div>

          {(tlExpired || insExpired) && picked && (
            <div className="flex items-start gap-2 border border-amber-500/30 bg-amber-500/10 text-amber-800 rounded-sm px-3 py-2 text-xs">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">{vendorDisplayName(picked)}</span>{" "}
                has expired{" "}
                {[tlExpired && "trade license", insExpired && "insurance"]
                  .filter(Boolean)
                  .join(" and ")}
                . You can still assign, but renew before scheduling new work.
              </div>
            </div>
          )}

          {willInitWorkflow && (
            <div className="flex items-start gap-2 border hairline bg-muted/30 rounded-sm px-3 py-2 text-xs text-architect">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-true-taupe" />
              <div>
                Assigning a vendor will start the{" "}
                <span className="font-medium">Vendor Dispatch</span> workflow.
                {costApprovalStatus === "not_required" && (
                  <> The landlord-approval step will be auto-skipped (cost below threshold).</>
                )}
                {costApprovalStatus === "approved" && (
                  <> The landlord-approval step will be auto-completed.</>
                )}
              </div>
            </div>
          )}

          {currentWorkflowKey && newVendorId && (
            <div className="flex items-start gap-2 border hairline bg-muted/30 rounded-sm px-3 py-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Vendor Dispatch workflow won't be added — ticket already uses{" "}
                <span className="text-architect">{WORKFLOWS[currentWorkflowKey].label}</span>.
                You can change workflow separately.
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[64px]"
              placeholder="Why this vendor, scope expectations, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={removeRequested ? "outline" : "gold"}
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {removeRequested ? "Remove vendor" : isChange ? "Change vendor" : "Assign vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
