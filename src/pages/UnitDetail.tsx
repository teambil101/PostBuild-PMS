import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Pencil, Trash2, AlertTriangle,
  History, Lock, Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { UnitFormDialog } from "@/components/properties/UnitFormDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoGallery } from "@/components/attachments/PhotoGallery";
import { DocumentList } from "@/components/attachments/DocumentList";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { OwnersCard } from "@/components/owners/OwnersCard";
import { LeaseWizard } from "@/components/contracts/lease/LeaseWizard";
import { MgmtAgreementPreconditionDialog } from "@/components/contracts/lease/MgmtAgreementPreconditionDialog";
import { ManagementAgreementWizard } from "@/components/contracts/ManagementAgreementWizard";
import { hasActiveMgmtAgreementForUnit } from "@/lib/leases";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { formatEnumLabel, sqmToSqft } from "@/lib/format";
import { isResidentialType, isStatusLockedByLease } from "@/lib/units";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Unit {
  id: string;
  ref_code: string;
  unit_number: string;
  unit_type: string;
  status: string;
  floor: number | null;
  size_sqm: number | null;
  size_unit_preference: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  status_locked_by_lease_id: string | null;
  building_id: string;
}

interface BuildingMini {
  id: string;
  name: string;
  building_type: string;
}

interface StatusEvent {
  id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  changed_at: string;
}

export default function UnitDetail() {
  const { buildingId, unitId } = useParams<{ buildingId: string; unitId: string }>();
  const navigate = useNavigate();
  const { canEdit } = useAuth();

  const [unit, setUnit] = useState<Unit | null>(null);
  const [building, setBuilding] = useState<BuildingMini | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);
  const [statusHistory, setStatusHistory] = useState<StatusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hasNoOwners, setHasNoOwners] = useState(false);
  const [preconditionOpen, setPreconditionOpen] = useState(false);
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [overrodePrecondition, setOverrodePrecondition] = useState(false);

  const startLeaseFlow = async () => {
    if (!unit) return;
    const ok = await hasActiveMgmtAgreementForUnit(unit.id);
    if (ok) {
      setOverrodePrecondition(false);
      setLeaseOpen(true);
    } else {
      setPreconditionOpen(true);
    }
  };

  const load = useCallback(async () => {
    if (!buildingId || !unitId) return;
    setLoading(true);
    const [u, b, ph, dc, nt, hi, gap] = await Promise.all([
      supabase.from("units").select("*").eq("id", unitId).maybeSingle(),
      supabase.from("buildings").select("id, name, building_type").eq("id", buildingId).maybeSingle(),
      supabase.from("photos").select("id", { count: "exact", head: true }).eq("entity_type", "unit").eq("entity_id", unitId),
      supabase.from("documents").select("id", { count: "exact", head: true }).eq("entity_type", "unit").eq("entity_id", unitId),
      supabase.from("notes").select("id", { count: "exact", head: true }).eq("entity_type", "unit").eq("entity_id", unitId),
      supabase.from("unit_status_history").select("*").eq("unit_id", unitId).order("changed_at", { ascending: false }).limit(50),
      supabase.from("units_without_owners").select("id", { count: "exact", head: true }).eq("id", unitId),
    ]);

    if (u.error || !u.data) {
      toast.error("Unit not found.");
      navigate(`/properties/${buildingId}`);
      return;
    }
    if (b.error || !b.data) {
      toast.error("Building not found.");
      navigate("/properties");
      return;
    }
    setUnit(u.data as Unit);
    setBuilding(b.data as BuildingMini);
    setPhotoCount(ph.count ?? 0);
    setDocCount(dc.count ?? 0);
    setNoteCount(nt.count ?? 0);
    setStatusHistory((hi.data ?? []) as StatusEvent[]);
    setHasNoOwners((gap.count ?? 0) > 0);
    setLoading(false);
  }, [buildingId, unitId, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!unit) return;
    if (unit.status_locked_by_lease_id) {
      toast.error("Cannot delete a unit with an active lease. End the lease first.");
      return;
    }
    const { error } = await supabase.from("units").delete().eq("id", unit.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Unit deleted.");
    navigate(`/properties/${buildingId}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-64 bg-muted/50 animate-pulse rounded-sm" />
        <div className="h-32 bg-muted/40 animate-pulse rounded-sm" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/40 animate-pulse rounded-sm" />
          ))}
        </div>
      </div>
    );
  }
  if (!unit || !building) return null;

  const locked = isStatusLockedByLease(unit);
  const occupiedNoLease = unit.status === "occupied" && !unit.status_locked_by_lease_id;
  const showResidential = isResidentialType(unit.unit_type);
  const hideFloor = building.building_type === "villa_compound";

  const sizeDisplay = (() => {
    if (unit.size_sqm == null) return { primary: "—", secondary: null as string | null };
    if (unit.size_unit_preference === "sqft") {
      return {
        primary: `${sqmToSqft(Number(unit.size_sqm))} ft²`,
        secondary: `≈ ${unit.size_sqm} m²`,
      };
    }
    return {
      primary: `${unit.size_sqm} m²`,
      secondary: `≈ ${sqmToSqft(Number(unit.size_sqm))} ft²`,
    };
  })();

  const floorDisplay = unit.floor == null ? "—" : unit.floor === 0 ? "G" : String(unit.floor);
  const subtitle = [
    formatEnumLabel(unit.unit_type),
    !hideFloor && unit.floor != null ? `Floor ${floorDisplay}` : null,
    building.name,
  ].filter(Boolean).join(" · ");

  const confirmReady = confirmText.trim() === unit.unit_number;

  return (
    <>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="label-eyebrow text-true-taupe mb-3 flex items-center gap-2">
        <Link to="/" className="hover:text-architect">Home</Link>
        <span>/</span>
        <Link to="/properties" className="hover:text-architect">Properties</Link>
        <span>/</span>
        <Link to={`/properties/${building.id}`} className="hover:text-architect truncate max-w-[200px]">{building.name}</Link>
        <span>/</span>
        <span>Units</span>
      </nav>

      <Button variant="ghost" size="sm" onClick={() => navigate(`/properties/${building.id}`)} className="mb-4">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {building.name}
      </Button>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b hairline pb-6">
        <div className="space-y-2 max-w-2xl min-w-0">
          <div className="label-eyebrow">Unit · {unit.ref_code}</div>
          <h1 className="font-display text-4xl md:text-5xl text-architect leading-tight">
            Unit {unit.unit_number}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setConfirmText(""); setDeleteOpen(true); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      {/* Lease warning banner */}
      {occupiedNoLease && (
        <div className="mb-6 flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 rounded-sm p-4">
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-900">
            <div className="font-medium">This unit is marked Occupied but has no lease on file.</div>
            <div className="text-xs text-amber-800/90 mt-0.5">Add lease details so the system reflects reality.</div>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-600/50 text-amber-900 hover:bg-amber-500/15"
              onClick={startLeaseFlow}
            >
              Add lease details
            </Button>
          )}
        </div>
      )}

      {/* No-owner warning banner */}
      {hasNoOwners && (
        <div className="mb-6 flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 rounded-sm p-4">
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-900">
            <div className="font-medium">This unit has no owner assigned.</div>
            <div className="text-xs text-amber-800/90 mt-0.5">
              Set ownership below, or add owners at the building level for inheritance.
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-warm-stone/60 border hairline rounded-sm overflow-hidden mb-10">
        <SummaryCard label="Status">
          <div className="flex items-center gap-2">
            <StatusBadge status={unit.status} />
            {locked && (
              <span title="Status is set by the active lease.">
                <Lock className="h-3 w-3 text-true-taupe" />
              </span>
            )}
          </div>
        </SummaryCard>
        <SummaryCard label="Size">
          <div className="font-display text-xl text-architect">{sizeDisplay.primary}</div>
          {sizeDisplay.secondary && (
            <div className="text-[11px] text-muted-foreground mt-0.5">{sizeDisplay.secondary}</div>
          )}
        </SummaryCard>
        <SummaryCard label="Type">
          <div className="font-display text-xl text-architect">{formatEnumLabel(unit.unit_type)}</div>
        </SummaryCard>
        {!hideFloor ? (
          <SummaryCard label="Floor">
            <div className="font-display text-xl text-architect">{floorDisplay}</div>
          </SummaryCard>
        ) : showResidential ? (
          <SummaryCard label="Beds / Baths">
            <div className="font-display text-xl text-architect">
              {(unit.bedrooms ?? "—")} / {(unit.bathrooms ?? "—")}
            </div>
          </SummaryCard>
        ) : (
          <SummaryCard label="Building">
            <div className="font-display text-base text-architect truncate">{building.name}</div>
          </SummaryCard>
        )}
      </div>

      <OwnersCard
        entityType="unit"
        entityId={unit.id}
        buildingId={building.id}
        buildingName={building.name}
        editable={canEdit}
        onChanged={load}
      />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-transparent border-b hairline rounded-none w-full justify-start gap-0 h-auto p-0 flex-wrap">
          {[
            { v: "overview", l: "Overview" },
            { v: "photos", l: `Photos (${photoCount})` },
            { v: "documents", l: `Documents (${docCount})` },
            { v: "notes", l: `Notes (${noteCount})` },
            { v: "history", l: "Status history" },
            { v: "lease", l: "Lease" },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none px-4 py-3 text-xs uppercase tracking-wider"
            >
              {t.l}
              {t.soon && (
                <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-sm normal-case tracking-normal">
                  Soon
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="pt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="label-eyebrow mb-2">Description</div>
              {unit.description ? (
                <p className="text-sm text-architect leading-relaxed whitespace-pre-wrap">{unit.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description yet.</p>
              )}
            </div>
            <div className="space-y-4">
              <DetailRow label="Reference code" value={unit.ref_code} mono />
              <DetailRow label="Unit number" value={unit.unit_number} />
              <DetailRow label="Type" value={formatEnumLabel(unit.unit_type)} />
              {!hideFloor && <DetailRow label="Floor" value={floorDisplay} />}
              <DetailRow label="Size" value={sizeDisplay.primary} />
              {showResidential && (
                <>
                  <DetailRow label="Bedrooms" value={unit.bedrooms?.toString() ?? "—"} />
                  <DetailRow label="Bathrooms" value={unit.bathrooms?.toString() ?? "—"} />
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* PHOTOS — gallery component lands in next pass */}
        <TabsContent value="photos" className="pt-6">
          <PhotoGallery
            entityType="unit"
            entityId={unit.id}
            editable={canEdit}
            onCountChange={setPhotoCount}
          />
        </TabsContent>

        {/* DOCUMENTS — list component lands in next pass */}
        <TabsContent value="documents" className="pt-6">
          <DocumentList
            entityType="unit"
            entityId={unit.id}
            editable={canEdit}
            onCountChange={setDocCount}
          />
        </TabsContent>

        {/* NOTES — composer + feed land in pass 3 */}
        <TabsContent value="notes" className="pt-6">
          <NotesPanel
            entityType="unit"
            entityId={unit.id}
            onCountChange={setNoteCount}
          />
        </TabsContent>

        {/* STATUS HISTORY */}
        <TabsContent value="history" className="pt-6">
          <div className="label-eyebrow mb-4">Status history</div>
          {statusHistory.length === 0 ? (
            <EmptyState
              icon={<History className="h-8 w-8" strokeWidth={1.2} />}
              title="No status changes yet"
              description="Edits to this unit's status will appear here."
            />
          ) : (
            <div className="space-y-2">
              {statusHistory.map((h) => (
                <div key={h.id} className="flex items-center gap-4 px-4 py-3 border hairline rounded-sm bg-card">
                  <div className="ref-code shrink-0">
                    {format(new Date(h.changed_at), "MMM d, yyyy · HH:mm")}
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-xs">
                    {h.old_status && <StatusBadge status={h.old_status} />}
                    <span className="text-muted-foreground">→</span>
                    <StatusBadge status={h.new_status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* LEASE */}
        <TabsContent value="lease" className="pt-6">
          <EmptyState
            icon={<Receipt className="h-8 w-8" strokeWidth={1.2} />}
            title="No lease on file for this unit"
            description="Create a lease to track rent, cheques, deposit, and tenant details."
            action={
              canEdit && (
                <Button variant="gold" onClick={startLeaseFlow}>
                  + Add lease
                </Button>
              )
            }
          />
        </TabsContent>
      </Tabs>

      {/* Edit modal */}
      <UnitFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        buildingId={building.id}
        parentBuildingType={building.building_type}
        initial={unit}
        onSaved={() => {
          setEditOpen(false);
          load();
        }}
      />

      {/* Lease entry */}
      <MgmtAgreementPreconditionDialog
        open={preconditionOpen}
        onOpenChange={setPreconditionOpen}
        onCreateMgmtAgreement={() => {
          setPreconditionOpen(false);
          setMgmtOpen(true);
        }}
        onProceedAnyway={() => {
          setPreconditionOpen(false);
          setOverrodePrecondition(true);
          setLeaseOpen(true);
        }}
      />
      <LeaseWizard
        open={leaseOpen}
        onOpenChange={setLeaseOpen}
        initialUnitId={unit.id}
        loggedMissingMgmt={overrodePrecondition}
        onSaved={() => { setLeaseOpen(false); load(); }}
      />
      <ManagementAgreementWizard
        open={mgmtOpen}
        onOpenChange={setMgmtOpen}
        onSaved={() => { setMgmtOpen(false); load(); }}
      />

      {/* Type-to-confirm delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit {unit.unit_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete all photos, documents, and notes attached to this unit. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-architect">
              Type <span className="mono">{unit.unit_number}</span> to confirm.
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={unit.unit_number}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmReady}
              onClick={handleDelete}
              className={cn(
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                !confirmReady && "opacity-50 pointer-events-none",
              )}
            >
              Delete unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card p-4">
      <div className="label-eyebrow">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b hairline pb-2">
      <div className="label-eyebrow">{label}</div>
      <div className={cn("text-sm text-architect text-right", mono && "mono text-xs")}>{value}</div>
    </div>
  );
}