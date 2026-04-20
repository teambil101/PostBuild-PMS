import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, addDays, addWeeks, addMonths } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  TICKET_TYPE_GROUPS,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  type TicketType,
  type TicketPriority,
  type TicketTargetType,
  nextTicketNumber,
} from "@/lib/tickets";
import { TicketTargetPicker } from "./TicketTargetPicker";
import { FileDropZone, validateFile } from "@/components/attachments/FileDropZone";
import {
  WORKFLOWS,
  getDefaultWorkflow,
  initializeTicketWorkflow,
  type WorkflowKey,
} from "@/lib/workflows";
import {
  PHOTO_BUCKET,
  PHOTO_MIMES,
  PHOTO_MAX_BYTES,
  DOC_BUCKET,
  DOC_MAX_BYTES,
  buildPhotoPath,
  buildDocPath,
  isPhotoMime,
} from "@/lib/storage";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SUBJECT_MAX = 200;
const DESCRIPTION_MAX = 4000;

export function NewTicketDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TicketType | "">("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [target, setTarget] = useState<{
    type: TicketTargetType;
    id: string | null;
  }>({ type: "unit", id: null });
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [reporterId, setReporterId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [estimatedCost, setEstimatedCost] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [workflowKey, setWorkflowKey] = useState<WorkflowKey | "__none">("__none");
  const [workflowOverridden, setWorkflowOverridden] = useState(false);

  const [people, setPeople] = useState<
    { id: string; first_name: string; last_name: string; company: string | null }[]
  >([]);
  const [selfPersonId, setSelfPersonId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setSubject("");
    setDescription("");
    setType("");
    setPriority("medium");
    setTarget({ type: "unit", id: null });
    setAssigneeId(null);
    setReporterId(null);
    setDueDate(undefined);
    setEstimatedCost("");
    setFiles([]);
    setThreshold(null);
    setWorkflowKey("__none");
    setWorkflowOverridden(false);
    setTimeout(() => subjectRef.current?.focus(), 50);
  }, [open]);

  // Load people once
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("people")
        .select("id, first_name, last_name, company, is_self")
        .order("first_name");
      setPeople(data ?? []);
      const self = (data ?? []).find((p: any) => p.is_self);
      if (self) setSelfPersonId(self.id);
    })();
  }, [open]);

  const isMaintenance = type.startsWith("maintenance_");

  // When type changes, auto-pick default workflow unless user overrode.
  useEffect(() => {
    if (workflowOverridden) return;
    if (!type) {
      setWorkflowKey("__none");
      return;
    }
    const def = getDefaultWorkflow(type);
    setWorkflowKey(def ?? "__none");
  }, [type, workflowOverridden]);

  // Threshold lookup when target + maintenance type set
  useEffect(() => {
    if (!isMaintenance || !target.id) {
      setThreshold(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_applicable_repair_threshold", {
        p_entity_type: target.type,
        p_entity_id: target.id,
      });
      if (!cancelled) setThreshold(typeof data === "number" ? data : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isMaintenance, target.type, target.id]);

  const peopleOptions = useMemo(() => {
    return people.map((p) => ({
      id: p.id,
      label: `${p.first_name} ${p.last_name}`.trim() + (p.company ? ` · ${p.company}` : ""),
    }));
  }, [people]);

  const validate = (): string | null => {
    if (!subject.trim() || subject.trim().length < 2) return "Subject is required (min 2 chars).";
    if (subject.length > SUBJECT_MAX) return `Subject must be ≤ ${SUBJECT_MAX} chars.`;
    if (!type) return "Pick a ticket type.";
    if (!target.id) return "Pick a target entity.";
    if (estimatedCost) {
      const n = Number(estimatedCost);
      if (!Number.isFinite(n) || n < 0) return "Estimated cost must be a non-negative number.";
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const reporter = reporterId ?? selfPersonId ?? null;

      // Retry on ticket_number collision (sequence drift / race).
      let created: { id: string; ticket_number: string } | null = null;
      let lastErr: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const ticket_number = await nextTicketNumber();
        const { data, error: insErr } = await supabase
          .from("tickets")
          .insert({
            ticket_number,
            subject: subject.trim(),
            description: description.trim() || null,
            ticket_type: type as string,
            priority,
            target_entity_type: target.type,
            target_entity_id: target.id as string,
            assignee_id: assigneeId,
            reporter_id: reporter,
            due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
            estimated_cost: estimatedCost ? Number(estimatedCost) : null,
            is_system_generated: false,
            created_by: user?.id ?? null,
          })
          .select("id, ticket_number")
          .maybeSingle();
        if (!insErr && data) {
          created = data as { id: string; ticket_number: string };
          break;
        }
        lastErr = insErr;
        // Only retry on unique-violation on ticket_number; otherwise bail.
        const msg = insErr?.message ?? "";
        if (!/tickets_ticket_number_key|duplicate key/i.test(msg)) break;
      }
      if (!created) {
        throw new Error(lastErr?.message ?? "Could not create ticket.");
      }

      // Upload attached files
      if (files.length > 0) {
        await uploadFiles(created.id, files, user?.id ?? null);
      }

      toast.success(`Ticket ${created.ticket_number} created.`);

      // Initialize workflow if one was selected.
      if (workflowKey !== "__none") {
        try {
          await initializeTicketWorkflow(created.id, workflowKey as WorkflowKey);
        } catch (wfErr: any) {
          toast.error(
            `Ticket created but workflow could not be initialized: ${wfErr.message ?? "unknown"}. Add it from the ticket page.`,
          );
        }
      }

      onOpenChange(false);
      navigate(`/tickets/${created.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not create ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-architect">New ticket</DialogTitle>
          <DialogDescription>
            Track an issue, task, or follow-up. Triggers will assign cost approval automatically for
            maintenance items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
              placeholder="Brief description of the issue or task"
              maxLength={SUBJECT_MAX}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
              placeholder="Any additional context, steps to reproduce, relevant details…"
              className="min-h-[88px] resize-y"
              maxLength={DESCRIPTION_MAX}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Type <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a type…" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {TICKET_TYPE_GROUPS.map((g) => (
                    <SelectGroup key={g.category}>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {g.category}
                      </SelectLabel>
                      {g.types.map((t) => (
                        <SelectItem key={t} value={t}>
                          {/* Show only the leaf inside the group header context */}
                          {TICKET_TYPE_LABELS[t].includes(":")
                            ? TICKET_TYPE_LABELS[t].split(":")[1].trim()
                            : TICKET_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Priority <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-4 border hairline rounded-sm overflow-hidden">
                {TICKET_PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "px-2 py-2 text-xs uppercase tracking-wider transition-colors",
                      priority === p
                        ? "bg-architect text-chalk"
                        : "text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {TICKET_PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Target <span className="text-destructive">*</span>
            </Label>
            <TicketTargetPicker
              value={target}
              onChange={(next) => setTarget({ type: next.type, id: next.id })}
            />
          </div>

          {type && (
            <WorkflowPickerInline
              ticketType={type}
              value={workflowKey}
              overridden={workflowOverridden}
              onChange={(v) => {
                setWorkflowKey(v);
                setWorkflowOverridden(true);
              }}
              onResetDefault={() => {
                const def = getDefaultWorkflow(type);
                setWorkflowKey(def ?? "__none");
                setWorkflowOverridden(false);
              }}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select
                value={assigneeId ?? "__none"}
                onValueChange={(v) => setAssigneeId(v === "__none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none">Leave unassigned</SelectItem>
                  {selfPersonId && (
                    <SelectItem value={selfPersonId}>Assign to me</SelectItem>
                  )}
                  {peopleOptions
                    .filter((p) => p.id !== selfPersonId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Reporter</Label>
              <Select
                value={reporterId ?? "__none"}
                onValueChange={(v) => setReporterId(v === "__none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Self (default)" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none">Self (default)</SelectItem>
                  {peopleOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Who raised this? Leave blank if you're raising it from internal observation.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Due date</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {[
                { label: "Today", date: new Date() },
                { label: "+3d", date: addDays(new Date(), 3) },
                { label: "+1w", date: addWeeks(new Date(), 1) },
                { label: "+1mo", date: addMonths(new Date(), 1) },
              ].map((q) => (
                <Button
                  key={q.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDueDate(q.date)}
                  className="h-8 text-xs"
                >
                  {q.label}
                </Button>
              ))}
              {dueDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDueDate(undefined)}
                  className="h-8 text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {isMaintenance && (
            <div className="space-y-1.5">
              <Label htmlFor="estimated_cost">Estimated cost (AED)</Label>
              <Input
                id="estimated_cost"
                type="number"
                min="0"
                step="1"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground">
                {target.id == null
                  ? "Pick a target to determine the repair approval threshold."
                  : threshold == null
                    ? "No management agreement found. Approval will be flagged as pending."
                    : `Repair threshold for this property: AED ${Number(threshold).toLocaleString()}. Above this, landlord approval is required.`}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Attach photos and files</Label>
            <FileDropZone
              compact={files.length > 0}
              onFiles={(fl) => setFiles((prev) => [...prev, ...fl])}
              helperText="Photos are especially useful for maintenance tickets."
            />
            {files.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between border hairline rounded-sm px-2 py-1.5 bg-muted/30">
                    <span className="truncate min-w-0">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-destructive hover:underline ml-2 shrink-0"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gold" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowPickerInline({
  ticketType,
  value,
  overridden,
  onChange,
  onResetDefault,
}: {
  ticketType: string;
  value: WorkflowKey | "__none";
  overridden: boolean;
  onChange: (v: WorkflowKey | "__none") => void;
  onResetDefault: () => void;
}) {
  const def = getDefaultWorkflow(ticketType);
  const [picking, setPicking] = useState(false);

  // If a default exists and we're not overridden and not picking, render compact line.
  if (def && !overridden && !picking) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground border hairline rounded-sm px-3 py-2 bg-muted/20">
        <span>
          Workflow:{" "}
          <span className="text-architect">{WORKFLOWS[def].label}</span>{" "}
          <span className="italic">(default for this type)</span>
        </span>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="text-architect underline decoration-gold/60 underline-offset-2 hover:decoration-gold"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Workflow</Label>
      <Select
        value={value}
        onValueChange={(v) => {
          onChange(v as WorkflowKey | "__none");
          setPicking(true);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Pick a workflow…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">None (freeform ticket)</SelectItem>
          {Object.values(WORKFLOWS).map((w) => (
            <SelectItem key={w.key} value={w.key}>
              {w.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {def
            ? `Default for this type: ${WORKFLOWS[def].label}.`
            : "No default workflow for this type. You can leave it blank or pick one."}
        </span>
        {def && (
          <button
            type="button"
            onClick={() => {
              setPicking(false);
              onResetDefault();
            }}
            className="text-architect underline decoration-gold/60 underline-offset-2 hover:decoration-gold"
          >
            Reset to default
          </button>
        )}
      </div>
    </div>
  );
}

async function uploadFiles(ticketId: string, files: File[], uploadedBy: string | null) {
  for (const file of files) {
    const id = crypto.randomUUID();
    const isImage = isPhotoMime(file.type);
    if (isImage) {
      const err = validateFile(file, PHOTO_MIMES, PHOTO_MAX_BYTES);
      if (err) {
        toast.error(err);
        continue;
      }
      const path = buildPhotoPath("ticket", ticketId, id, file.name);
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        continue;
      }
      const { error: dbErr } = await supabase.from("photos").insert({
        id,
        entity_type: "ticket",
        entity_id: ticketId,
        storage_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        is_cover: false,
        sort_order: 0,
        uploaded_by: uploadedBy ?? undefined,
      });
      if (dbErr) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        toast.error(dbErr.message);
      }
    } else {
      const err = validateFile(file, null, DOC_MAX_BYTES);
      if (err) {
        toast.error(err);
        continue;
      }
      const path = buildDocPath("ticket", ticketId, id, file.name);
      const { error: upErr } = await supabase.storage
        .from(DOC_BUCKET)
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        continue;
      }
      const { error: dbErr } = await supabase.from("documents").insert({
        id,
        entity_type: "ticket",
        entity_id: ticketId,
        storage_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type || "application/octet-stream",
        doc_type: "other",
        uploaded_by: uploadedBy ?? undefined,
      });
      if (dbErr) {
        await supabase.storage.from(DOC_BUCKET).remove([path]);
        toast.error(dbErr.message);
      }
    }
  }
}