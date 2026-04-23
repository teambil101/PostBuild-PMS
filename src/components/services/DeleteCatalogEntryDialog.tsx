import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Trash2, ArrowRightLeft, History as HistoryIcon } from "lucide-react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { CatalogEntry } from "./CatalogEntryDialog";
import { cn } from "@/lib/utils";

interface ActiveRequestRef {
  id: string;
  request_number: string;
  title: string;
  status: string;
}

interface WorkflowRef {
  catalog_id: string;
  catalog_name: string;
  catalog_code: string;
  step_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: CatalogEntry | null;
  allEntries: CatalogEntry[];
  onDeleted: () => void;
}

const ACTIVE_STATUSES = ["open", "scheduled", "in_progress", "blocked"] as const;

export function DeleteCatalogEntryDialog({ open, onOpenChange, entry, allEntries, onDeleted }: Props) {
  const [loading, setLoading] = useState(false);
  const [activeRequests, setActiveRequests] = useState<ActiveRequestRef[]>([]);
  const [historicalCount, setHistoricalCount] = useState(0);
  const [workflowRefs, setWorkflowRefs] = useState<WorkflowRef[]>([]);
  const [replacementId, setReplacementId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const replacementOptions = useMemo(
    () => allEntries.filter((e) => e.id !== entry?.id && e.is_active),
    [allEntries, entry?.id],
  );

  const loadUsage = async () => {
    if (!entry) return;
    setLoading(true);
    try {
      // Active service requests directly referencing this catalog entry
      const { data: reqRows } = await supabase
        .from("service_requests")
        .select("id, request_number, title, status")
        .eq("catalog_id", entry.id)
        .in("status", ACTIVE_STATUSES as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(200);
      setActiveRequests((reqRows ?? []) as ActiveRequestRef[]);

      // Historical (completed / cancelled) — preserved on delete (catalog_id set null by FK)
      const { count: histCount } = await supabase
        .from("service_requests")
        .select("*", { count: "exact", head: true })
        .eq("catalog_id", entry.id)
        .in("status", ["completed", "cancelled"]);
      setHistoricalCount(histCount ?? 0);

      // Workflow steps in OTHER catalog entries that reference this one
      const { data: catRows } = await supabase
        .from("service_catalog")
        .select("id, name, code, workflow_steps")
        .eq("is_workflow", true)
        .neq("id", entry.id);
      const refs: WorkflowRef[] = [];
      (catRows ?? []).forEach((row: any) => {
        const steps = Array.isArray(row.workflow_steps) ? row.workflow_steps : [];
        const matches = steps.filter((s: any) => s?.catalog_id === entry.id);
        if (matches.length > 0) {
          refs.push({
            catalog_id: row.id,
            catalog_name: row.name,
            catalog_code: row.code,
            step_count: matches.length,
          });
        }
      });
      setWorkflowRefs(refs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && entry) {
      setReplacementId("");
      void loadUsage();
    }
  }, [open, entry?.id]);

  const activeRefCount = activeRequests.length + workflowRefs.length;
  const canDelete = activeRefCount === 0;

  const replaceAll = async () => {
    if (!entry || !replacementId) return;
    setBusy(true);
    try {
      // 1) Reassign active service requests
      if (activeRequests.length > 0) {
        const { error: reqErr } = await supabase
          .from("service_requests")
          .update({ catalog_id: replacementId })
          .eq("catalog_id", entry.id)
          .in("status", ACTIVE_STATUSES as unknown as string[]);
        if (reqErr) throw reqErr;
      }

      // 2) Patch workflow_steps[].catalog_id in other catalog entries
      for (const ref of workflowRefs) {
        const { data: row } = await supabase
          .from("service_catalog")
          .select("workflow_steps")
          .eq("id", ref.catalog_id)
          .maybeSingle();
        const steps = Array.isArray(row?.workflow_steps) ? (row!.workflow_steps as any[]) : [];
        const patched = steps.map((s) =>
          s?.catalog_id === entry.id ? { ...s, catalog_id: replacementId } : s,
        );
        const { error: upErr } = await supabase
          .from("service_catalog")
          .update({ workflow_steps: patched as any })
          .eq("id", ref.catalog_id);
        if (upErr) throw upErr;
      }

      toast.success("References reassigned. You can delete now.");
      void loadUsage();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to reassign references");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!entry || !canDelete) return;
    setBusy(true);
    try {
      // Historical request rows have FK ON DELETE SET NULL, so they're preserved.
      // Their snapshot fields (title, category, etc.) keep the historical record intact.
      const { error } = await supabase.from("service_catalog").delete().eq("id", entry.id);
      if (error) throw error;
      toast.success(
        historicalCount > 0
          ? `Service deleted. ${historicalCount} historical request${historicalCount === 1 ? "" : "s"} preserved.`
          : "Service deleted.",
      );
      onDeleted();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to delete service");
    } finally {
      setBusy(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-architect inline-flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Delete &ldquo;{entry.name}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Removes this service from the catalog. Historical request records are preserved with their snapshot data — only their link to this catalog entry is cleared.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking usage…
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <UsageCard
                label="Active requests"
                count={activeRequests.length}
                tone={activeRequests.length > 0 ? "warning" : "ok"}
              />
              <UsageCard
                label="Used in workflows"
                count={workflowRefs.length}
                tone={workflowRefs.length > 0 ? "warning" : "ok"}
              />
              <UsageCard
                label="Historical (preserved)"
                count={historicalCount}
                tone="neutral"
                icon={<HistoryIcon className="h-3 w-3" />}
              />
            </div>

            {/* Blocking references */}
            {activeRefCount > 0 && (
              <div className="border hairline rounded-sm border-amber-500/40 bg-amber-500/5 p-4 space-y-4">
                <div className="inline-flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Cannot delete — service is still in use.</div>
                    <div className="text-xs text-amber-700/90 mt-0.5">
                      Reassign the {activeRefCount} active reference{activeRefCount === 1 ? "" : "s"} below to another service, then delete.
                    </div>
                  </div>
                </div>

                {activeRequests.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="label-eyebrow text-muted-foreground">
                      Active service requests ({activeRequests.length})
                    </div>
                    <div className="border hairline rounded-sm bg-card divide-y hairline max-h-44 overflow-y-auto">
                      {activeRequests.map((r) => (
                        <div key={r.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                          <span className="mono text-muted-foreground">{r.request_number}</span>
                          <span className="flex-1 truncate text-architect">{r.title}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {r.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workflowRefs.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="label-eyebrow text-muted-foreground">
                      Used as a step in workflows ({workflowRefs.length})
                    </div>
                    <div className="border hairline rounded-sm bg-card divide-y hairline max-h-32 overflow-y-auto">
                      {workflowRefs.map((w) => (
                        <div key={w.catalog_id} className="px-3 py-2 flex items-center gap-3 text-xs">
                          <span className="mono text-muted-foreground">{w.catalog_code}</span>
                          <span className="flex-1 truncate text-architect">{w.catalog_name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {w.step_count} step{w.step_count === 1 ? "" : "s"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Single global replacement */}
                <div className="border-t hairline pt-3 space-y-2">
                  <Label className="text-xs">
                    Replace all active references with
                  </Label>
                  <div className="flex gap-2">
                    <Select value={replacementId} onValueChange={setReplacementId} disabled={busy}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Pick a replacement service…" />
                      </SelectTrigger>
                      <SelectContent>
                        {replacementOptions.length === 0 ? (
                          <div className="px-2 py-3 text-xs text-muted-foreground">
                            No other active services available.
                          </div>
                        ) : (
                          replacementOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.name}{" "}
                              <span className="mono text-[10px] text-muted-foreground ml-1">
                                {opt.code}
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button onClick={replaceAll} disabled={!replacementId || busy} variant="outline">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                      Reassign all
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    The same replacement is applied to every active request and workflow step. Historical records are not touched.
                  </p>
                </div>
              </div>
            )}

            {canDelete && (
              <div className="border hairline rounded-sm border-destructive/40 bg-destructive/5 p-4">
                <div className="text-sm text-destructive font-medium">Ready to delete.</div>
                <p className="text-xs text-destructive/80 mt-1">
                  No active references remain.{" "}
                  {historicalCount > 0
                    ? `${historicalCount} historical request${historicalCount === 1 ? "" : "s"} will keep their snapshot data but lose the catalog link.`
                    : "This service has no historical usage either."}{" "}
                  This cannot be undone.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={doDelete}
            disabled={!canDelete || busy || loading}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete service
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsageCard({
  label,
  count,
  tone,
  icon,
}: {
  label: string;
  count: number;
  tone: "ok" | "warning" | "neutral";
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border hairline rounded-sm p-3",
        tone === "warning" && "border-amber-500/40 bg-amber-500/5",
        tone === "ok" && "bg-card",
        tone === "neutral" && "bg-muted/30",
      )}
    >
      <div className="label-eyebrow text-muted-foreground inline-flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "font-display text-2xl mt-1",
          tone === "warning" ? "text-amber-700" : "text-architect",
        )}
      >
        {count}
      </div>
    </div>
  );
}