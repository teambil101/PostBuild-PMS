import { AlertTriangle, Briefcase } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** User chose to create a management agreement first */
  onCreateMgmtAgreement: () => void;
  /** User chose to proceed to the lease wizard anyway (soft-block override) */
  onProceedAnyway: () => void;
}

/**
 * Soft-block warning shown before the lease wizard opens when the target unit
 * is NOT covered by an active management agreement (directly or via its building).
 * Users can either create the missing mgmt agreement first, or proceed anyway —
 * an audit note is logged on the new lease in the latter case.
 */
export function MgmtAgreementPreconditionDialog({
  open,
  onOpenChange,
  onCreateMgmtAgreement,
  onProceedAnyway,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-sm bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-700" strokeWidth={1.5} />
            </div>
            <div className="flex-1 space-y-1">
              <AlertDialogTitle className="font-display text-lg leading-tight">
                No management agreement covers this property
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed">
                You need an active management agreement authorizing you to manage this
                unit (or its building) before you can create a lease. You can create one
                now, or proceed anyway and resolve the gap later — the lease will note
                the missing agreement in its history.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <AlertDialogCancel className="sm:mr-auto">Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            onClick={onProceedAnyway}
          >
            Create lease anyway
          </Button>
          <AlertDialogAction asChild>
            <Button type="button" variant="gold" onClick={onCreateMgmtAgreement}>
              <Briefcase className="h-4 w-4" />
              Create management agreement
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}