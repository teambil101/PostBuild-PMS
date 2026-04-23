import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  BILLING_LABEL,
  CATEGORY_LABEL,
  DELIVERY_LABEL,
  EMPTY_STEP,
  slugify,
  type WorkflowStep,
} from "@/lib/services";
import { CatalogServicePicker, type CatalogPickerEntry } from "./CatalogServicePicker";

interface Props {
  value: WorkflowStep[];
  onChange: (next: WorkflowStep[]) => void;
  /** Optional: catalog ID being edited, so it can't reference itself. */
  selfCatalogId?: string | null;
}

export function WorkflowStepsEditor({ value, onChange, selfCatalogId }: Props) {
  // Resolve referenced catalog entries so we can show defaults inline.
  const [resolved, setResolved] = useState<Record<string, CatalogPickerEntry>>({});

  useEffect(() => {
    const ids = value.map((s) => s.catalog_id).filter((id) => id && !resolved[id]);
    if (ids.length === 0) return;
    void (async () => {
      const { data } = await supabase
        .from("service_catalog")
        .select("id, code, name, category, category_other, default_delivery, default_billing, typical_duration_days, is_workflow")
        .in("id", ids);
      if (!data) return;
      setResolved((prev) => {
        const next = { ...prev };
        (data as CatalogPickerEntry[]).forEach((e) => {
          next[e.id] = e;
        });
        return next;
      });
    })();
  }, [value, resolved]);

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
      { ...EMPTY_STEP, key: `step_${value.length + 1}` },
    ]);

  const excludeIds = selfCatalogId ? [selfCatalogId] : [];

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <div className="border hairline rounded-sm bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No steps yet — chain catalog services below to compose this workflow.
        </div>
      )}

      <ol className="space-y-2">
        {value.map((step, i) => {
          const ref = step.catalog_id ? resolved[step.catalog_id] : null;
          const isLegacy = !step.catalog_id && (step.title || step.category);
          return (
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
                <div className="flex items-center gap-2">
                  <span className="mono text-[10px] text-muted-foreground shrink-0">STEP {i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <CatalogServicePicker
                      value={step.catalog_id || null}
                      excludeIds={excludeIds}
                      onChange={(entry) => {
                        setResolved((prev) => ({ ...prev, [entry.id]: entry }));
                        update(i, {
                          catalog_id: entry.id,
                          key: step.key || slugify(entry.code) || `step_${i + 1}`,
                          // Drop legacy fields when upgrading.
                          title: undefined,
                          category: undefined,
                          category_other: undefined,
                          default_delivery: undefined,
                          default_billing: undefined,
                          typical_duration_days: undefined,
                        });
                      }}
                    />
                  </div>
                </div>

                {isLegacy && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-sm px-2.5 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      Legacy step <span className="mono">{step.title || step.key}</span> — pick a catalog service above to upgrade it.
                    </span>
                  </div>
                )}

                {ref && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span className="border hairline rounded-sm px-1.5 py-0.5">
                      {ref.category === "other" && ref.category_other
                        ? ref.category_other
                        : CATEGORY_LABEL[ref.category]}
                    </span>
                    <span className="border hairline rounded-sm px-1.5 py-0.5">
                      {DELIVERY_LABEL[ref.default_delivery as keyof typeof DELIVERY_LABEL] ?? ref.default_delivery}
                    </span>
                    <span className="border hairline rounded-sm px-1.5 py-0.5">
                      {BILLING_LABEL[ref.default_billing as keyof typeof BILLING_LABEL] ?? ref.default_billing}
                    </span>
                    {ref.typical_duration_days != null && (
                      <span className="border hairline rounded-sm px-1.5 py-0.5">~{ref.typical_duration_days}d</span>
                    )}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Title override (optional)
                    </Label>
                    <Input
                      value={step.title_override ?? ""}
                      onChange={(e) => update(i, { title_override: e.target.value || null })}
                      placeholder={ref?.name ?? "Use catalog name"}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Duration override (days)
                    </Label>
                    <Input
                      type="number"
                      value={step.duration_override_days ?? ""}
                      onChange={(e) =>
                        update(i, {
                          duration_override_days: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder={ref?.typical_duration_days != null ? String(ref.typical_duration_days) : "—"}
                      className="mt-1 h-8 text-xs"
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
          );
        })}
      </ol>

      <Button type="button" variant="outline" onClick={add} className="w-full">
        <Plus className="h-4 w-4" />
        Add step
      </Button>
    </div>
  );
}
