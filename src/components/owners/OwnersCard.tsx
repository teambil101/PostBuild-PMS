import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Pencil, Plus, Info, AlertTriangle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  OwnerDraft,
  OwnerEntityType,
  fetchOwners,
  resolveUnitOwners,
  replaceOwners,
  clearOwners,
  validateOwners,
  countInheritingUnits,
} from "@/lib/ownership";
import { OwnerPicker } from "./OwnerPicker";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface Props {
  entityType: OwnerEntityType;
  entityId: string;
  /** Required for unit cards so we can resolve / display inherited owners. */
  buildingId?: string;
  buildingName?: string;
  /** Whether the current user can edit. */
  editable: boolean;
  /** Callback when ownership data changes (so parent can refresh data-gap counts etc.). */
  onChanged?: () => void;
}

type Mode = "view" | "edit";

/**
 * Owners card used on Building Detail and Unit Detail pages.
 * - Buildings: optional ownership. Empty state allowed.
 * - Units: shows inherited building owners as a fallback if no unit-level rows.
 */
export function OwnersCard({
  entityType,
  entityId,
  buildingId,
  buildingName,
  editable,
  onChanged,
}: Props) {
  const isUnit = entityType === "unit";
  const [loading, setLoading] = useState(true);
  const [explicit, setExplicit] = useState<OwnerDraft[]>([]);  // rows from this entity
  const [inherited, setInherited] = useState<OwnerDraft[]>([]); // building rows when unit has none
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<OwnerDraft[]>([]);
  const [busy, setBusy] = useState(false);

  // Cascade / orphan dialogs (building-only)
  const [cascadeOpen, setCascadeOpen] = useState(false);
  const [cascadeNoticeUnits, setCascadeNoticeUnits] = useState(0);
  const [orphanOpen, setOrphanOpen] = useState(false);
  const [orphanCount, setOrphanCount] = useState(0);
  const [revertOpen, setRevertOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const own = await fetchOwners(entityType, entityId);
      setExplicit(own);
      if (isUnit && own.length === 0 && buildingId) {
        const inh = await fetchOwners("building", buildingId);
        setInherited(inh);
      } else {
        setInherited([]);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load owners.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, buildingId]);

  const isInheriting = isUnit && explicit.length === 0 && inherited.length > 0;
  const visibleRows = explicit.length > 0 ? explicit : inherited;
  const total = useMemo(
    () => visibleRows.reduce((acc, r) => acc + Number(r.ownership_percentage || 0), 0),
    [visibleRows],
  );

  // ------- Editing flows -------

  const beginEditExplicit = () => {
    setDraft(explicit.map((r) => ({ ...r })));
    setMode("edit");
  };

  const beginAddFirst = () => {
    setDraft([]);
    setMode("edit");
  };

  const beginSetUnitSpecific = () => {
    // Copy the inherited building owners as a starting point
    setDraft(
      inherited.map((r) => ({
        person_id: r.person_id,
        person_name: r.person_name,
        person_company: r.person_company,
        ownership_percentage: r.ownership_percentage,
        is_primary: r.is_primary,
      })),
    );
    setMode("edit");
  };

  const cancelEdit = () => {
    setDraft([]);
    setMode("view");
  };

  const performSave = async () => {
    setBusy(true);
    try {
      await replaceOwners(entityType, entityId, draft);
      toast.success("Ownership saved.");
      setMode("view");
      setDraft([]);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save ownership.");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const v = validateOwners(draft);
    if (!v.valid) {
      toast.error(v.reason ?? "Owners are not valid.");
      return;
    }

    // Building-specific cascade flows
    if (entityType === "building") {
      const wasEmpty = explicit.length === 0;
      // ADDING owners to a building that previously had none → cascade prompt
      if (wasEmpty && draft.length > 0) {
        const n = await countInheritingUnits(entityId);
        setCascadeNoticeUnits(n);
        setCascadeOpen(true);
        return; // user confirms in dialog
      }
    }

    await performSave();
  };

  // Building-only: removing all owners. Triggered from a separate "Remove all" button.
  const handleClearAll = async () => {
    if (entityType === "building") {
      const n = await countInheritingUnits(entityId);
      if (n > 0) {
        setOrphanCount(n);
        setOrphanOpen(true);
        return;
      }
    }
    setBusy(true);
    try {
      await clearOwners(entityType, entityId);
      toast.success("Owners removed.");
      setMode("view");
      setDraft([]);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message ?? "Could not remove owners.");
    } finally {
      setBusy(false);
    }
  };

  const performClearAll = async () => {
    setBusy(true);
    try {
      await clearOwners(entityType, entityId);
      toast.success("Owners removed.");
      setMode("view");
      setDraft([]);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message ?? "Could not remove owners.");
    } finally {
      setBusy(false);
      setOrphanOpen(false);
    }
  };

  const performRevertToInherit = async () => {
    setBusy(true);
    try {
      await clearOwners("unit", entityId);
      toast.success("Reverted to inherited ownership.");
      setMode("view");
      setDraft([]);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message ?? "Could not revert.");
    } finally {
      setBusy(false);
      setRevertOpen(false);
    }
  };

  // ------- Render -------

  return (
    <section className="border hairline rounded-sm bg-card p-5 mb-8" aria-label="Owners">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl text-architect">Owners</h2>
          {entityType === "building" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-architect" aria-label="About building owners">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Optional. Set only if the entire building is owned by a single entity or shared by a known set of owners.
                  Otherwise, set ownership per unit.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isInheriting && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-sm bg-muted text-muted-foreground">
              <Info className="h-3 w-3" /> Inherited
            </span>
          )}
        </div>
        {editable && mode === "view" && (
          <div className="flex items-center gap-2">
            {explicit.length > 0 && (
              <Button variant="outline" size="sm" onClick={beginEditExplicit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {explicit.length === 0 && !isInheriting && (
              <Button variant="gold" size="sm" onClick={beginAddFirst}>
                <Plus className="h-3.5 w-3.5" /> Add owner
              </Button>
            )}
            {isInheriting && (
              <Button variant="outline" size="sm" onClick={beginSetUnitSpecific}>
                Set unit-specific ownership
              </Button>
            )}
          </div>
        )}
      </header>

      {loading ? (
        <div className="h-16 bg-muted/40 animate-pulse rounded-sm" />
      ) : mode === "edit" ? (
        <div className="space-y-4">
          {isUnit && inherited.length > 0 && explicit.length === 0 && (
            <div className="text-xs text-muted-foreground border-l-2 border-gold/60 pl-3">
              Copied from {buildingName ?? "the parent building"}. Changes apply only to this unit.
            </div>
          )}
          <OwnerPicker
            value={draft}
            onChange={setDraft}
            footer={
              isUnit && explicit.length > 0 ? (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setRevertOpen(true)}
                    className="text-xs text-muted-foreground hover:text-architect underline underline-offset-2"
                  >
                    Revert to inherit from building
                  </button>
                </div>
              ) : null
            }
          />
          <div className="flex items-center justify-between gap-2 pt-2 border-t hairline">
            <div>
              {entityType === "building" && explicit.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={handleClearAll} disabled={busy}>
                  <span className="text-destructive">Remove all owners</span>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} disabled={busy}>Cancel</Button>
              <Button type="button" variant="gold" size="sm" onClick={handleSave} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : visibleRows.length === 0 ? (
        entityType === "building" ? (
          <EmptyState
            title="No building-level owner set"
            description="Units carry their own ownership."
          />
        ) : (
          <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 rounded-sm p-4">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-amber-900">
              <div className="font-medium">This unit has no owner assigned.</div>
              <div className="text-xs text-amber-800/90 mt-0.5">
                Set a unit owner, or add an owner at the building level for inheritance.
              </div>
            </div>
            {editable && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-600/50 text-amber-900 hover:bg-amber-500/15"
                onClick={beginAddFirst}
              >
                Set owner
              </Button>
            )}
          </div>
        )
      ) : (
        <>
          {isInheriting && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Inherited from{" "}
                {buildingId ? (
                  <Link to={`/properties/${buildingId}`} className="text-architect hover:text-gold underline underline-offset-2">
                    {buildingName ?? "building"}
                  </Link>
                ) : (
                  buildingName ?? "the parent building"
                )}
                . Use “Set unit-specific ownership” above to override.
              </span>
            </div>
          )}
          <ul className="divide-y divide-warm-stone/60">
            {visibleRows.map((r) => (
              <li key={r.id ?? r.person_id} className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 shrink-0 bg-architect text-chalk flex items-center justify-center rounded-sm text-xs font-medium">
                  {initials(r.person_name?.split(" ")[0], r.person_name?.split(" ").slice(1).join(" "))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/people/${r.person_id}`}
                      className="font-display text-base text-architect hover:text-gold truncate"
                    >
                      {r.person_name || "Unnamed person"}
                    </Link>
                    {r.is_primary && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-gold/15 text-gold-deep text-[10px] uppercase tracking-wider"
                        title="Primary owner"
                      >
                        <Star className="h-3 w-3 fill-current" /> Primary
                      </span>
                    )}
                  </div>
                  {r.person_company && (
                    <div className="text-xs text-muted-foreground truncate">{r.person_company}</div>
                  )}
                </div>
                <div className="font-display text-lg text-architect tabular-nums shrink-0">
                  {Number(r.ownership_percentage).toString().replace(/\.?0+$/, "")}%
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t hairline pt-3 mt-1 text-xs">
            <span className="label-eyebrow">Total</span>
            <span className={cn("font-medium", total === 100 ? "text-emerald-700" : "text-destructive")}>
              {total}%
            </span>
          </div>
        </>
      )}

      {/* Cascade dialog (building only, when adding owners to a building that had none) */}
      <AlertDialog open={cascadeOpen} onOpenChange={setCascadeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cascade ownership to units?</AlertDialogTitle>
            <AlertDialogDescription>
              This building has {cascadeNoticeUnits} unit{cascadeNoticeUnits === 1 ? "" : "s"} without explicit ownership.
              They will automatically inherit this building's ownership going forward. Units that already have their
              own owners are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} onClick={() => setCascadeOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => { setCascadeOpen(false); await performSave(); }}
              className="bg-gold text-architect hover:bg-gold/90"
            >
              Save ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Orphan dialog (building only, when removing all owners while units inherit) */}
      <AlertDialog open={orphanOpen} onOpenChange={setOrphanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave units without owners?</AlertDialogTitle>
            <AlertDialogDescription>
              {orphanCount} unit{orphanCount === 1 ? "" : "s"} currently inherit ownership from this building.
              Removing all building owners will leave them without assigned owners. You'll need to set ownership per unit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={performClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Proceed anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert-to-inherit dialog (unit only) */}
      <AlertDialog open={revertOpen} onOpenChange={setRevertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert to inherited ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              Unit-specific owner rows will be deleted. Ownership will fall back to the building's owners.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={performRevertToInherit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}