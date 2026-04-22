import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unitId: string;
  unitNumber: string;
  onSaved: () => void;
}

export function UnlistDialog({ open, onOpenChange, unitId, unitNumber, onSaved }: Props) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("units")
      .update({ listed_at: null, asking_rent: null, listing_notes: null })
      .eq("id", unitId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${unitNumber} unlisted.`);
    onOpenChange(false);
    onSaved();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unlist {unitNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            The unit will return to "Ready but unlisted". Asking rent and listing notes will be cleared.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep listed</AlertDialogCancel>
          <AlertDialogAction onClick={handle} disabled={busy}>
            {busy ? "Unlisting…" : "Unlist"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
