import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CatalogPicker } from "@/components/services/CatalogPicker";
import { TargetPicker, type TargetType } from "@/components/services/TargetPicker";
import { BillingBadge, DeliveryBadge } from "@/components/services/CatalogBadges";
import type { CatalogEntry } from "@/components/services/CatalogEntryDialog";
import { PRIORITY_LABEL, type ServiceRequestPriority } from "@/lib/services";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  BILL_TO_MODE_LABEL,
  BILL_TO_MODE_DESC,
  type BillToMode,
} from "@/lib/vendor-services";
import { Users } from "lucide-react";

const STEPS = [
  { key: 1, label: "Service" },
  { key: 2, label: "Target" },
  { key: 3, label: "Details" },
];

export default function NewServiceRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledDate = searchParams.get("scheduled_date") ?? "";
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [catalog, setCatalog] = useState<CatalogEntry | null>(null);
  const [targetType, setTargetType] = useState<TargetType>("unit");
  const [targetId, setTargetId] = useState<string | null>(null);

  const [priority, setPriority] = useState<ServiceRequestPriority>("normal");
  const [scheduledDate, setScheduledDate] = useState<string>(prefilledDate);
  const [description, setDescription] = useState("");
  const [costEstimate, setCostEstimate] = useState<string>("");
  const [billToMode, setBillToMode] = useState<BillToMode>("landlord_only");
  const [landlordShare, setLandlordShare] = useState<number>(100);
  const [autoInviteVendors, setAutoInviteVendors] = useState<boolean>(true);

  const next = () => {
    if (step === 1 && !catalog) {
      toast.error("Pick a service from the catalog.");
      return;
    }
    if (step === 2 && !targetId) {
      toast.error("Pick a unit.");
      return;
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    if (!catalog) return;
    if (billToMode === "split" && (landlordShare <= 0 || landlordShare >= 100)) {
      toast.error("Use 'landlord pays' or 'tenant pays' instead of 0% / 100% split.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("create_service_request_from_catalog", {
        p_catalog_id: catalog.id,
        p_target_type: "unit",
        p_target_id: targetId,
        p_priority: priority,
        p_scheduled_date: scheduledDate || null,
        p_description: description.trim() || null,
        p_assigned_vendor_id: null,
        p_assigned_person_id: null,
        p_requested_by_person_id: null,
        p_source: "staff",
        p_cost_estimate: costEstimate ? Number(costEstimate) : null,
        p_override_title: null,
        p_internal_notes: null,
        p_bill_to_mode: billToMode,
        p_landlord_share_percent:
          billToMode === "landlord_only"
            ? 100
            : billToMode === "tenant_only"
              ? 0
              : billToMode === "split"
                ? landlordShare
                : 100,
        p_tenant_share_percent:
          billToMode === "landlord_only"
            ? 0
            : billToMode === "tenant_only"
              ? 100
              : billToMode === "split"
                ? 100 - landlordShare
                : 0,
        p_auto_invite_vendors: autoInviteVendors,
      });
      if (error) throw error;
      toast.success(
        autoInviteVendors
          ? "Request created — matching vendors invited to quote"
          : catalog.is_workflow
            ? "Workflow request created"
            : "Request created",
      );
      navigate(`/services/requests/${data}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to create request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="New service request"
        description="Create a work order from your catalog. Workflow services explode into ordered sub-steps automatically."
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                "h-7 w-7 rounded-full border hairline flex items-center justify-center text-[11px]",
                step === s.key && "bg-architect text-chalk border-architect",
                step > s.key && "bg-status-occupied/20 text-status-occupied border-status-occupied/40",
                step < s.key && "text-muted-foreground",
              )}
            >
              {s.key}
            </div>
            <span
              className={cn(
                "text-[11px] uppercase tracking-wider",
                step === s.key ? "text-architect" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-warm-stone/60" />}
          </div>
        ))}
      </div>

      <Card className="hairline">
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Pick a service</CardTitle>
            </CardHeader>
            <CardContent>
              <CatalogPicker selectedId={catalog?.id ?? null} onSelect={setCatalog} />
              {catalog && (
                <div className="mt-4 border hairline rounded-sm bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Selected</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-architect font-medium">{catalog.name}</span>
                    <DeliveryBadge value={catalog.default_delivery} />
                    <BillingBadge value={catalog.default_billing} />
                    {catalog.is_workflow && (
                      <span className="text-[10px] uppercase tracking-wider text-architect">
                        · {catalog.workflow_steps.length} sub-steps will be created
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Where should this happen?</CardTitle>
            </CardHeader>
            <CardContent>
              <TargetPicker
                targetType={targetType}
                targetId={targetId}
                onChange={(t, id) => {
                  setTargetType(t);
                  setTargetId(id);
                }}
              />
            </CardContent>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as ServiceRequestPriority)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_LABEL) as ServiceRequestPriority[]).map((p) => (
                        <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Scheduled date (optional)</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Cost estimate (optional)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={costEstimate}
                    onChange={(e) => setCostEstimate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label>Description (what's the issue / scope?)</Label>
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tenant reports water leak under kitchen sink…"
                  className="mt-1.5"
                />
              </div>

            {/* ---- Cost split ---- */}
            <div className="border hairline rounded-sm p-4 space-y-4 bg-muted/20">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-architect mb-1">
                  Who pays?
                </div>
                <Select
                  value={billToMode}
                  onValueChange={(v) => {
                    const m = v as BillToMode;
                    setBillToMode(m);
                    if (m === "split" && (landlordShare === 0 || landlordShare === 100)) {
                      setLandlordShare(50);
                    }
                  }}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(BILL_TO_MODE_LABEL) as BillToMode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {BILL_TO_MODE_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {BILL_TO_MODE_DESC[billToMode]}
                </p>
              </div>

              {billToMode === "split" && (
                <div>
                  <Label className="text-xs">Landlord share</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Slider
                      value={[landlordShare]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={(v) => setLandlordShare(v[0])}
                      className="flex-1"
                    />
                    <span className="mono tabular-nums text-xs text-architect w-24 text-right">
                      {landlordShare}% / {100 - landlordShare}%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Landlord pays {landlordShare}%, tenant pays {100 - landlordShare}% of the
                    accepted vendor quote.
                  </p>
                </div>
              )}
            </div>

            {/* ---- Auto-invite ---- */}
            <div className="flex items-start justify-between border hairline rounded-sm p-4 gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-architect flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Auto-invite matching vendors
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  When on, every active vendor who covers this service in the unit's city is
                  invited to submit a quote as soon as the request is created.
                </p>
              </div>
              <Switch checked={autoInviteVendors} onCheckedChange={setAutoInviteVendors} />
            </div>
            </CardContent>
          </>
        )}

        <div className="flex items-center justify-between p-4 border-t hairline">
          <Button variant="ghost" onClick={() => (step === 1 ? navigate("/services") : back())} disabled={saving}>
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < STEPS.length ? (
            <Button onClick={next}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create request
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}