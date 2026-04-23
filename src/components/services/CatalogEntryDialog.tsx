import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  BILLING_LABEL,
  CADENCE_LABEL,
  CATEGORY_LABEL,
  DELIVERY_LABEL,
  slugify,
  type ServiceBilling,
  type ServiceCadence,
  type ServiceCategory,
  type ServiceDelivery,
  type WorkflowStep,
} from "@/lib/services";
import { WorkflowStepsEditor } from "./WorkflowStepsEditor";

export interface CatalogEntry {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: ServiceCategory;
  category_other: string | null;
  default_delivery: ServiceDelivery;
  default_billing: ServiceBilling;
  typical_duration_days: number | null;
  cadence: ServiceCadence;
  recurrence_interval_days: number | null;
  is_workflow: boolean;
  workflow_steps: WorkflowStep[];
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: CatalogEntry | null; // null = create mode
  onSaved: () => void;
}

const BLANK: CatalogEntry = {
  id: "",
  code: "",
  name: "",
  description: "",
  category: "maintenance",
  category_other: null,
  default_delivery: "vendor",
  default_billing: "paid",
  typical_duration_days: 1,
  cadence: "one_off",
  recurrence_interval_days: null,
  is_workflow: false,
  workflow_steps: [],
  is_active: true,
};

export function CatalogEntryDialog({ open, onOpenChange, entry, onSaved }: Props) {
  const [form, setForm] = useState<CatalogEntry>(BLANK);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("basics");

  useEffect(() => {
    if (open) {
      setForm(entry ?? BLANK);
      setTab("basics");
    }
  }, [open, entry]);

  const update = <K extends keyof CatalogEntry>(key: K, val: CatalogEntry[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    const code = (form.code || slugify(form.name)).toUpperCase();
    if (!code) {
      toast.error("Code is required.");
      return;
    }
    if (form.is_workflow && form.workflow_steps.length === 0) {
      toast.error("Add at least one step, or untoggle the workflow option.");
      return;
    }
    if (form.category === "other" && !(form.category_other ?? "").trim()) {
      toast.error("Describe the 'Other' category.");
      return;
    }
    if (form.is_workflow) {
      const badStep = form.workflow_steps.find(
        (s) => s.category === "other" && !(s.category_other ?? "").trim(),
      );
      if (badStep) {
        toast.error(`Describe the 'Other' category for step "${badStep.title || badStep.key}".`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        code,
        name: form.name.trim(),
        description: form.description?.trim() || null,
        category: form.category,
        category_other:
          form.category === "other" ? (form.category_other ?? "").trim() || null : null,
        default_delivery: form.default_delivery,
        default_billing: form.default_billing,
        typical_duration_days: form.typical_duration_days,
        cadence: form.cadence,
        recurrence_interval_days:
          form.cadence === "custom" ? form.recurrence_interval_days : null,
        is_workflow: form.is_workflow,
        workflow_steps: form.is_workflow ? (form.workflow_steps as any) : [],
        is_active: form.is_active,
      };
      const { error } = entry
        ? await supabase.from("service_catalog").update(payload).eq("id", entry.id)
        : await supabase.from("service_catalog").insert(payload);
      if (error) throw error;
      toast.success(entry ? "Service updated" : "Service added to catalog");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-architect">
            {entry ? "Edit catalog entry" : "New catalog entry"}
          </DialogTitle>
          <DialogDescription>
            Define how this service is normally delivered, billed and scheduled. Atomic services have one job; workflow templates explode into ordered sub-steps.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="workflow">
              Workflow {form.is_workflow && form.workflow_steps.length > 0 ? `(${form.workflow_steps.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="space-y-4 mt-5">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. AC service / repair"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => update("code", e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                  placeholder={form.name ? slugify(form.name).toUpperCase() : "AC_SERVICE"}
                  className="mt-1.5 mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Auto-generated from name if blank.</p>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What does this service cover? When is it used?"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => update("category", v as ServiceCategory)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABEL) as ServiceCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.category === "other" && (
                <div className="mt-2">
                  <Label htmlFor="cat-other" className="text-xs text-muted-foreground">
                    Describe category *
                  </Label>
                  <Input
                    id="cat-other"
                    value={form.category_other ?? ""}
                    onChange={(e) => update("category_other", e.target.value)}
                    placeholder="e.g. Concierge, Move coordination…"
                    maxLength={80}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 p-3 border hairline rounded-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} />
              <div className="flex-1">
                <div className="text-sm text-architect">Active in menu</div>
                <div className="text-[11px] text-muted-foreground">Off = staff can't pick this when creating new requests.</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="defaults" className="space-y-4 mt-5">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Default delivery</Label>
                <Select value={form.default_delivery} onValueChange={(v) => update("default_delivery", v as ServiceDelivery)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DELIVERY_LABEL) as ServiceDelivery[]).map((d) => (
                      <SelectItem key={d} value={d}>{DELIVERY_LABEL[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default billing</Label>
                <Select value={form.default_billing} onValueChange={(v) => update("default_billing", v as ServiceBilling)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(BILLING_LABEL) as ServiceBilling[]).map((b) => (
                      <SelectItem key={b} value={b}>{BILLING_LABEL[b]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Free = covered by PM agreement. Paid = needs quote/approval. Pass-through = govt or 3rd-party fee.
                </p>
              </div>
              <div>
                <Label>Typical duration (days)</Label>
                <Input
                  type="number"
                  value={form.typical_duration_days ?? ""}
                  onChange={(e) =>
                    update("typical_duration_days", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Cadence</Label>
                <Select value={form.cadence} onValueChange={(v) => update("cadence", v as ServiceCadence)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CADENCE_LABEL) as ServiceCadence[]).map((c) => (
                      <SelectItem key={c} value={c}>{CADENCE_LABEL[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Recurring services are auto-scheduled by the system later.
                </p>
              </div>
              {form.cadence === "custom" && (
                <div>
                  <Label>Interval (days)</Label>
                  <Input
                    type="number"
                    value={form.recurrence_interval_days ?? ""}
                    onChange={(e) =>
                      update("recurrence_interval_days", e.target.value === "" ? null : Number(e.target.value))
                    }
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4 mt-5">
            <div className="flex items-center gap-3 p-3 border hairline rounded-sm">
              <Switch checked={form.is_workflow} onCheckedChange={(v) => update("is_workflow", v)} />
              <div className="flex-1">
                <div className="text-sm text-architect">This service is a multi-step workflow</div>
                <div className="text-[11px] text-muted-foreground">
                  Pick this for engagements like Tenant Search & Onboarding that explode into ordered sub-steps.
                </div>
              </div>
            </div>

            {form.is_workflow ? (
              <WorkflowStepsEditor
                value={form.workflow_steps}
                onChange={(steps) => update("workflow_steps", steps)}
              />
            ) : (
              <div className="border hairline rounded-sm bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Atomic service — one job, no sub-steps. Toggle the switch above to add steps.
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {entry ? "Save changes" : "Add to catalog"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
