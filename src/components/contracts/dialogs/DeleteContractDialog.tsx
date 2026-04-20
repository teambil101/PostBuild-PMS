import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  contractNumber: string;
}

export function DeleteContractDialog({ open, onOpenChange, contractId, contractNumber }: Props) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setConfirm("");
  }, [open]);

  const canDelete = confirm.trim() === contractNumber;

  const handle = async () => {
    if (!canDelete) return;
    setSubmitting(true);
    const { error } = await supabase.from("contracts").delete().eq("id", contractId);
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    toast.success("Draft contract deleted.");
    onOpenChange(false);
    navigate("/contracts");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete this draft contract?</DialogTitle>
          <DialogDescription>
            This will permanently remove the contract and all attached parties, subjects, documents, and notes.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label className="label-eyebrow">
            Type <span className="mono text-architect">{contractNumber}</span> to confirm
          </Label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={contractNumber}
            className="mono"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            onClick={handle}
            disabled={!canDelete || submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}