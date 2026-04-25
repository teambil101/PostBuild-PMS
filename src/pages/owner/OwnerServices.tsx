import { useEffect, useMemo, useState } from "react";
import { Sparkles, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { formatEnumLabel } from "@/lib/format";
import { toast } from "sonner";

interface CatalogEntry {
  id: string;
  name: string;
  description: string | null;
  category: string;
}

interface BuildingOpt {
  id: string;
  name: string;
}

export default function OwnerServices() {
  const { activeWorkspace } = useWorkspace();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [buildings, setBuildings] = useState<BuildingOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<CatalogEntry | null>(null);
  const [targetId, setTargetId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    (async () => {
      // Marketplace = any active catalog entry visible to this user.
      // Owner workspaces have no catalog of their own; the operator workspace's
      // catalog is exposed once cross-workspace marketplace policies land in
      // Phase 3. For now we read whatever is visible (RLS may show none).
      const [cat, bld] = await Promise.all([
        supabase
          .from("service_catalog")
          .select("id, name, description, category")
          .eq("is_marketplace", true)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("buildings")
          .select("id, name")
          .eq("workspace_id", activeWorkspace.id)
          .order("name"),
      ]);
      setCatalog(((cat.data ?? []) as unknown) as CatalogEntry[]);
      setBuildings(((bld.data ?? []) as unknown) as BuildingOpt[]);
      setLoading(false);
    })();
  }, [activeWorkspace?.id]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, CatalogEntry[]> = {};
    for (const c of catalog) {
      const key = c.category ?? "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  }, [catalog]);

  const submit = async () => {
    if (!picked || !targetId) {
      toast.error("Pick a property first");
      return;
    }
    if (!activeWorkspace) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("create_marketplace_service_request", {
      _requester_workspace_id: activeWorkspace.id,
      _catalog_id: picked.id,
      _building_id: targetId,
      _description: notes || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request submitted — our team will be in touch");
    setPicked(null);
    setTargetId("");
    setNotes("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Request a service"
        description="Cleaning, maintenance, photography, listing, valuation — pick what you need and we'll take it from there."
      />

      {loading ? null : catalog.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" strokeWidth={1.5} />}
          title="No services available yet"
          description="The marketplace will be live shortly. In the meantime, contact our team directly."
        />
      ) : (
        Object.entries(groupedByCategory).map(([category, items]) => (
          <div key={category} className="space-y-3">
            <div className="label-eyebrow text-muted-foreground">{formatEnumLabel(category)}</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPicked(c)}
                  className="text-left"
                >
                  <Card className="p-4 h-full hover:border-architect/40 transition-colors">
                    <div className="font-display text-base text-architect">{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-muted-foreground mt-2 line-clamp-3">{c.description}</div>
                    )}
                    <div className="mt-3 text-xs text-gold mono uppercase">Request →</div>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request: {picked?.name}</DialogTitle>
            <DialogDescription>
              Pick the property and add any notes. Our team will accept and reach back to you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Property</Label>
              {buildings.length === 0 ? (
                <div className="border hairline rounded-sm p-3 text-sm text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" strokeWidth={1.5} />
                  Add a property first to request a service.
                </div>
              ) : (
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Anything we should know?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicked(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || buildings.length === 0}>
              {submitting ? "Sending…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}