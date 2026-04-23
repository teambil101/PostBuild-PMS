import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  BILLING_LABEL,
  CATEGORY_LABEL,
  DELIVERY_LABEL,
  type ServiceBilling,
  type ServiceCategory,
  type ServiceDelivery,
} from "@/lib/services";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  onAdded: () => void | Promise<void>;
}

export function AddStepDialog({ open, onOpenChange, requestId, onAdded }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ServiceCategory>("tenant_lifecycle");
  const [delivery, setDelivery] = useState<ServiceDelivery>("staff");
  const [billing, setBilling] = useState<ServiceBilling>("free");
  const [duration, setDuration] = useState<string>("");
  const [costEstimate, setCostEstimate] = useState<string>("");
  const [blocksNext, setBlocksNext] = useState(false);
  const [working, setWorking] = useState(false);

  const reset = () => {
    setTitle("");
    setCategory("tenant_lifecycle");
    setDelivery("staff");
    setBilling("free");
    setDuration("");
    setCostEstimate("");
    setBlocksNext(false);
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setWorking(true);
    const { error } = await supabase.rpc("add_service_request_step", {
      p_request_id: requestId,
      p_title: title.trim(),
      p_category: category,
      p_delivery: delivery,
      p_billing: billing,
      p_blocks_next: blocksNext,
      p_typical_duration_days: duration ? Number(duration) : null,
      p_cost_estimate: billing === "paid" && costEstimate ? Number(costEstimate) : null,
    });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Step added");
    reset();
    onOpenChange(false);
    await onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add ad-hoc step</DialogTitle>
          <DialogDescription>
            Insert a new step at the end of this workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tenant requested AC service"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ServiceCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Delivery</Label>
              <Select value={delivery} onValueChange={(v) => setDelivery(v as ServiceDelivery)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DELIVERY_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Billing</Label>
              <Select value={billing} onValueChange={(v) => setBilling(v as ServiceBilling)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BILLING_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Typical days</Label>
              <Input
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          {billing === "paid" && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Cost estimate (AED)
              </Label>
              <Input
                type="number"
                min={0}
                value={costEstimate}
                onChange={(e) => setCostEstimate(e.target.value)}
                placeholder="—"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                If above the management agreement threshold, will require landlord approval.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between border-t hairline pt-3">
            <div>
              <Label className="text-sm">Blocks next steps</Label>
              <p className="text-[10px] text-muted-foreground">
                Subsequent steps cannot be completed until this one is done.
              </p>
            </div>
            <Switch checked={blocksNext} onCheckedChange={setBlocksNext} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={working || !title.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Add step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}