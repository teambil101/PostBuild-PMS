import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  TICKET_PRIORITIES, TICKET_PRIORITY_LABELS,
  type TicketPriority,
} from "@/lib/tickets";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: {
    id: string;
    subject: string;
    description: string | null;
    priority: TicketPriority;
    due_date: string | null;
    estimated_cost: number | null;
    actual_cost: number | null;
    currency: string;
    ticket_type: string;
  };
  onDone: () => void;
}

const SUBJECT_MAX = 200;
const DESC_MAX = 4000;

export function EditTicketDialog({ open, onOpenChange, ticket, onDone }: Props) {
  const [subject, setSubject] = useState(ticket.subject);
  const [description, setDescription] = useState(ticket.description ?? "");
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    ticket.due_date ? new Date(ticket.due_date) : undefined,
  );
  const [estimatedCost, setEstimatedCost] = useState(
    ticket.estimated_cost != null ? String(ticket.estimated_cost) : "",
  );
  const [actualCost, setActualCost] = useState(
    ticket.actual_cost != null ? String(ticket.actual_cost) : "",
  );
  const [busy, setBusy] = useState(false);

  const isMaintenance = ticket.ticket_type.startsWith("maintenance_");

  useEffect(() => {
    if (!open) return;
    setSubject(ticket.subject);
    setDescription(ticket.description ?? "");
    setPriority(ticket.priority);
    setDueDate(ticket.due_date ? new Date(ticket.due_date) : undefined);
    setEstimatedCost(ticket.estimated_cost != null ? String(ticket.estimated_cost) : "");
    setActualCost(ticket.actual_cost != null ? String(ticket.actual_cost) : "");
  }, [open, ticket]);

  const handleSubmit = async () => {
    if (!subject.trim() || subject.trim().length < 2) {
      toast.error("Subject is required (min 2 chars).");
      return;
    }
    if (estimatedCost) {
      const n = Number(estimatedCost);
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Estimated cost must be ≥ 0.");
        return;
      }
    }
    if (actualCost) {
      const n = Number(actualCost);
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Actual cost must be ≥ 0.");
        return;
      }
    }
    setBusy(true);
    const { error } = await supabase.from("tickets").update({
      subject: subject.trim(),
      description: description.trim() || null,
      priority,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      estimated_cost: estimatedCost ? Number(estimatedCost) : null,
      actual_cost: actualCost ? Number(actualCost) : null,
    }).eq("id", ticket.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket updated.");
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit ticket</DialogTitle>
          <DialogDescription>
            Update the subject, description, priority, due date and cost. Status, type, target, and assignee
            have their own actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Subject <span className="text-destructive">*</span></Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
              maxLength={SUBJECT_MAX}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
              className="min-h-[88px] resize-y"
              maxLength={DESC_MAX}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <div className="grid grid-cols-4 border hairline rounded-sm overflow-hidden">
              {TICKET_PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "px-2 py-2 text-xs uppercase tracking-wider transition-colors",
                    priority === p ? "bg-architect text-chalk" : "text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  {TICKET_PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Due date</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-[200px] justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {dueDate && (
                <Button variant="ghost" size="sm" onClick={() => setDueDate(undefined)}>Clear</Button>
              )}
            </div>
          </div>

          {isMaintenance && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estimated cost ({ticket.currency})</Label>
                <Input type="number" min="0" step="1" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Actual cost ({ticket.currency})</Label>
                <Input type="number" min="0" step="1" value={actualCost} onChange={(e) => setActualCost(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="gold" onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
