import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  currentStatus: string;
  subjectsCount: number;
  onActivated?: () => void;
}

export function ActivateContractDialog({ open, onOpenChange, contractId, currentStatus, subjectsCount, onActivated }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const handle = async () => {
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("contracts")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", contractId);
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    await supabase.from("contract_events").insert({
      contract_id: contractId,
      event_type: "status_changed",
      from_value: currentStatus,
      to_value: "active",
      description: "Activated",
      actor_id: u.user?.id,
    });
    setSubmitting(false);
    toast.success("Contract activated.");
    onOpenChange(false);
    onActivated?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Activate this management agreement?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks the agreement as in effect. You'll be authorized to manage the {subjectsCount}{" "}
            {subjectsCount === 1 ? "property" : "properties"} listed under this contract.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handle}
            disabled={submitting}
            className="bg-status-occupied text-chalk hover:bg-status-occupied/90"
          >
            {submitting ? "Activating…" : "Activate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}