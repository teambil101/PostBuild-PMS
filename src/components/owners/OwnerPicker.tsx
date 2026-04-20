import { useMemo } from "react";
import { Star, Trash2, Plus, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { OwnerDraft, sumPercent, validateOwners } from "@/lib/ownership";
import { PersonCombobox, PickedPerson } from "./PersonCombobox";

interface Props {
  value: OwnerDraft[];
  onChange: (rows: OwnerDraft[]) => void;
  /** Optional inline notice rendered above the rows (e.g. "Copied from Building X"). */
  notice?: React.ReactNode;
  /** Optional footer slot rendered below the sum indicator (e.g. "Revert to inherit" link). */
  footer?: React.ReactNode;
}

/**
 * Controlled owner picker.
 * Each row: person combobox + percentage input + primary star + remove.
 * The sum + primary validators are surfaced in the footer.
 */
export function OwnerPicker({ value, onChange, notice, footer }: Props) {
  const rows = value;
  const total = sumPercent(rows);
  const validation = useMemo(() => validateOwners(rows), [rows]);

  const update = (idx: number, patch: Partial<OwnerDraft>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const setPrimary = (idx: number) => {
    onChange(rows.map((r, i) => ({ ...r, is_primary: i === idx })));
  };

  const remove = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    // If we removed the primary, promote the first remaining row to primary
    if (next.length > 0 && !next.some((r) => r.is_primary)) {
      next[0] = { ...next[0], is_primary: true };
    }
    onChange(next);
  };

  const add = () => {
    const remaining = Math.max(0, 100 - total);
    const next: OwnerDraft = {
      person_id: "",
      person_name: "",
      ownership_percentage: remaining > 0 ? remaining : 0,
      is_primary: rows.length === 0,
    };
    onChange([...rows, next]);
  };

  const handlePersonPicked = (idx: number, p: PickedPerson) => {
    update(idx, {
      person_id: p.id,
      person_name: `${p.first_name} ${p.last_name}`.trim(),
      person_company: p.company,
    });
  };

  const usedIds = rows.map((r) => r.person_id).filter(Boolean);

  // Sum indicator color
  const sumState = total === 100 ? "ok" : total < 100 ? "low" : "high";
  const sumColor =
    sumState === "ok" ? "text-emerald-700" : sumState === "low" ? "text-amber-700" : "text-destructive";
  const sumLabel =
    sumState === "ok"
      ? "Total: 100%"
      : sumState === "low"
        ? `Total: ${total}% — add ${(100 - total).toFixed(2).replace(/\.?0+$/, "")}%`
        : `Total: ${total}% — exceeds 100%`;

  return (
    <div className="space-y-3">
      {notice && <div className="text-xs text-muted-foreground">{notice}</div>}

      {rows.length === 0 ? (
        <div className="border hairline border-dashed rounded-sm p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">No owners assigned yet.</p>
          <Button type="button" variant="gold" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Add owner
          </Button>
        </div>
      ) : (
        <>
          {/* Header row, hidden on mobile */}
          <div className="hidden md:grid md:grid-cols-[1fr_120px_44px_44px] gap-2 px-1 label-eyebrow">
            <span>Owner</span>
            <span className="text-right">Percentage</span>
            <span className="text-center">Primary</span>
            <span />
          </div>

          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_100px_44px_36px] md:grid-cols-[1fr_120px_44px_44px] gap-2 items-center"
              >
                <PersonCombobox
                  value={row.person_id}
                  valueLabel={row.person_name}
                  onChange={(p) => handlePersonPicked(idx, p)}
                  excludeIds={usedIds}
                  invalid={!row.person_id}
                  placeholder="Search people…"
                />
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    max={100}
                    step={0.01}
                    value={Number.isFinite(row.ownership_percentage) ? row.ownership_percentage : ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? 0 : Number(e.target.value);
                      update(idx, { ownership_percentage: Number.isFinite(v) ? v : 0 });
                    }}
                    className="text-right pr-6"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrimary(idx)}
                  aria-label={row.is_primary ? "Primary owner" : "Set primary owner"}
                  title={row.is_primary ? "Primary owner" : "Set as primary"}
                  className={cn(
                    "h-10 flex items-center justify-center rounded-sm border hairline transition-colors",
                    row.is_primary
                      ? "bg-gold/15 border-gold/60 text-gold-deep"
                      : "bg-background hover:bg-muted/40 text-true-taupe",
                  )}
                >
                  <Star
                    className={cn("h-4 w-4", row.is_primary && "fill-current")}
                    strokeWidth={row.is_primary ? 1.5 : 1.8}
                  />
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(idx)}
                  aria-label="Remove owner"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Add owner
          </Button>

          {/* Sum indicator */}
          <div className="flex items-center justify-between border-t hairline pt-3">
            <div className={cn("text-sm font-medium flex items-center gap-2", sumColor)}>
              {sumState === "ok" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {sumLabel}
            </div>
            {validation.primaryCount !== 1 && (
              <div className="text-xs text-amber-700">
                {validation.primaryCount === 0
                  ? "Mark one primary owner."
                  : `${validation.primaryCount} primaries selected — only one allowed.`}
              </div>
            )}
          </div>
        </>
      )}

      {footer}
    </div>
  );
}