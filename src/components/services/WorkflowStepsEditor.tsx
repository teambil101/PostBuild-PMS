import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BILLING_LABEL,
  CATEGORY_LABEL,
  DELIVERY_LABEL,
  EMPTY_STEP,
  slugify,
  type ServiceBilling,
  type ServiceCategory,
  type ServiceDelivery,
  type WorkflowStep,
} from "@/lib/services";

interface Props {
  value: WorkflowStep[];
  onChange: (next: WorkflowStep[]) => void;
}

export function WorkflowStepsEditor({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<WorkflowStep>) => {
    const next = value.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const add = () =>
    onChange([
      ...value,
      { ...EMPTY_STEP, key: `step_${value.length + 1}`, title: `Step ${value.length + 1}` },
    ]);

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <div className="border hairline rounded-sm bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No steps yet — add the first one below.
        </div>
      )}

      <ol className="space-y-2">
        {value.map((step, i) => (
          <li key={i} className="border hairline rounded-sm bg-card p-3 md:p-4">
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center pt-1.5 text-muted-foreground">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="hover:text-architect disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <GripVertical className="h-4 w-4 my-0.5 opacity-50" />
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  className="hover:text-architect disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="mono text-[10px] text-muted-foreground shrink-0">STEP {i + 1}</span>
                  <Input
                    value={step.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      const newKey = step.key && step.key !== slugify(value[i]?.title ?? "") ? step.key : slugify(title);
                      update(i, { title, key: newKey || `step_${i + 1}` });
                    }}
                    placeholder="Step title…"
                    className="h-8 text-sm"
                  />
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</Label>
                    <Select
                      value={step.category}
                      onValueChange={(v) => update(i, { category: v as ServiceCategory })}
                    >
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CATEGORY_LABEL) as ServiceCategory[]).map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivery</Label>
                    <Select
                      value={step.default_delivery}
                      onValueChange={(v) => update(i, { default_delivery: v as ServiceDelivery })}
                    >
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(DELIVERY_LABEL) as ServiceDelivery[]).map((d) => (
                          <SelectItem key={d} value={d}>{DELIVERY_LABEL[d]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Billing</Label>
                    <Select
                      value={step.default_billing}
                      onValueChange={(v) => update(i, { default_billing: v as ServiceBilling })}
                    >
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(BILLING_LABEL) as ServiceBilling[]).map((b) => (
                          <SelectItem key={b} value={b}>{BILLING_LABEL[b]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration (days)</Label>
                    <Input
                      type="number"
                      value={step.typical_duration_days ?? ""}
                      onChange={(e) =>
                        update(i, {
                          typical_duration_days: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="mt-1 h-8 text-xs"
                      placeholder="—"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={step.blocks_next}
                    onCheckedChange={(v) => update(i, { blocks_next: v })}
                  />
                  <span>Blocks next step until done (advisory in v1)</span>
                </label>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Remove step"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <Button type="button" variant="outline" onClick={add} className="w-full">
        <Plus className="h-4 w-4" />
        Add step
      </Button>
    </div>
  );
}
