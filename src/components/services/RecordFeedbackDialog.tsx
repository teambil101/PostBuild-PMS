import { useEffect, useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface RecordFeedbackDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  serviceRequestId: string;
  /** When provided, the dialog starts in edit mode for an existing feedback row. */
  existing?: { id: string; rating: number; comment: string | null } | null;
  onSaved?: () => void;
}

export function RecordFeedbackDialog({
  open,
  onOpenChange,
  serviceRequestId,
  existing,
  onSaved,
}: RecordFeedbackDialogProps) {
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState<string>(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRating(existing?.rating ?? 0);
      setComment(existing?.comment ?? "");
      setHover(0);
    }
  }, [open, existing]);

  const submit = async () => {
    if (rating < 1 || rating > 5) {
      toast.error("Please select a star rating from 1 to 5.");
      return;
    }
    setBusy(true);
    const auth = await supabase.auth.getUser();
    const submittedBy = auth.data.user?.id ?? null;
    let submittedByPersonId: string | null = null;
    if (submittedBy) {
      const { data: person } = await supabase
        .from("people")
        .select("id")
        .eq("auth_user_id", submittedBy)
        .maybeSingle();
      submittedByPersonId = person?.id ?? null;
    }

    if (existing) {
      const { error } = await supabase
        .from("service_feedback")
        .update({ rating, comment: comment.trim() || null })
        .eq("id", existing.id);
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Feedback updated");
    } else {
      const { error } = await supabase.from("service_feedback").insert({
        service_request_id: serviceRequestId,
        rating,
        comment: comment.trim() || null,
        submitted_by_person_id: submittedByPersonId,
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Feedback recorded");
    }
    onOpenChange(false);
    onSaved?.();
  };

  const display = hover || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Update customer feedback" : "Record customer feedback"}</DialogTitle>
          <DialogDescription>
            Capture how the customer felt about this completed job. Used in performance and quality dashboards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block">Rating</Label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="p-1 rounded-sm hover:bg-muted/40 transition-colors"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={cn(
                      "h-7 w-7 transition-colors",
                      n <= display ? "fill-gold text-gold" : "text-muted-foreground/40",
                    )}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
              <span className="ml-3 mono text-xs text-muted-foreground tabular-nums">
                {rating > 0 ? `${rating}/5` : "—"}
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="feedback-comment" className="mb-2 block">
              Comment (optional)
            </Label>
            <Textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did the customer say?"
              rows={4}
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || rating < 1}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {existing ? "Save changes" : "Record feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
