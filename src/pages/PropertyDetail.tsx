import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { BuildingFormDialog } from "@/components/properties/BuildingFormDialog";
import { UnitFormDialog } from "@/components/properties/UnitFormDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoGallery } from "@/components/attachments/PhotoGallery";
import { DocumentList } from "@/components/attachments/DocumentList";
import { toast } from "sonner";
import { format } from "date-fns";
import { COUNTRY_BY_CODE } from "@/lib/countries";
import { formatEnumLabel, sqmToSqft } from "@/lib/format";
import { isStatusLockedByLease } from "@/lib/units";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Building {
  id: string;
  ref_code: string;
  name: string;
  location_url: string | null;
  city: string;
  country: string;
  building_type: string;
  community: string | null;
}

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
  status_locked_by_lease_id: string | null;
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = useAuth();

  const [building, setBuilding] = useState<Building | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [leasePrompt, setLeasePrompt] = useState<{ unitId: string } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [b, u, ph, dc, h] = await Promise.all([
      supabase.from("buildings").select("*").eq("id", id).maybeSingle(),
      supabase.from("units").select("*").eq("building_id", id).order("unit_number"),
      supabase.from("photos").select("id", { count: "exact", head: true }).eq("entity_type", "building").eq("entity_id", id),
      supabase.from("documents").select("id", { count: "exact", head: true }).eq("entity_type", "building").eq("entity_id", id),
      supabase
        .from("property_status_history")
        .select("*, units!inner(unit_number, ref_code, building_id)")
        .eq("units.building_id", id)
        .order("changed_at", { ascending: false })
        .limit(20),
    ]);
    if (b.error || !b.data) {
      toast.error("Building not found.");
      navigate("/properties");
      return;
    }
    setBuilding(b.data as Building);
    setUnits((u.data ?? []) as Unit[]);
    setPhotoCount(ph.count ?? 0);
    setDocCount(dc.count ?? 0);
    setHistory(h.data ?? []);
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!building) return;
    const { error } = await supabase.from("buildings").delete().eq("id", building.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Building deleted.");
      navigate("/properties");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted/50 animate-pulse rounded-sm" />
        <div className="h-64 bg-muted/40 animate-pulse rounded-sm" />
      </div>
    );
  }
  if (!building) return null;

  const occupiedNoLease = units.filter(
    (u) => u.status === "occupied" && !u.status_locked_by_lease_id,
  );
  const formatSize = (u: Unit) => {
    if (u.size_sqm == null) return "—";
    if (u.size_unit_preference === "sqft") return `${sqmToSqft(Number(u.size_sqm))} ft²`;
    return `${u.size_sqm} m²`;
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate("/properties")} className="mb-4">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to properties
      </Button>

      <PageHeader
        eyebrow={`Building · ${building.ref_code}`}
        title={building.name}
        description={building.location_url ?? undefined}
        actions={
          canEdit && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this building?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All units, documents, and history will be removed. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )
        }
      />

      {occupiedNoLease.length > 0 && (
        <div className="mb-6 flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 rounded-sm p-4">
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-900">
            <div className="font-medium">
              {occupiedNoLease.length === 1
                ? "1 unit is marked Occupied but has no lease on file."
                : `${occupiedNoLease.length} units are marked Occupied but have no lease on file.`}
            </div>
            <div className="text-xs text-amber-800/90 mt-0.5">
              Add lease details so the system reflects reality.
            </div>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-600/50 text-amber-900 hover:bg-amber-500/15"
              onClick={() => toast("Lease creation coming soon")}
            >
              Add lease details
            </Button>
          )}
        </div>
      )}

      {/* Meta strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-warm-stone/60 border hairline rounded-sm overflow-hidden mb-10">
        <Meta label="Location" value={[building.city, COUNTRY_BY_CODE[building.country] ?? building.country].filter(Boolean).join(", ") || "—"} icon={<MapPin className="h-3.5 w-3.5" />} />
        <Meta label="Type" value={formatEnumLabel(building.building_type) || "—"} icon={<Building2 className="h-3.5 w-3.5" />} />
        <Meta label="Community" value={building.community ?? "—"} icon={<MapPin className="h-3.5 w-3.5" />} />
        <Meta label="Units" value={units.length.toString()} icon={<Building2 className="h-3.5 w-3.5" />} />
      </div>

      <Tabs defaultValue="units" className="w-full">
        <TabsList className="bg-transparent border-b hairline rounded-none w-full justify-start gap-0 h-auto p-0">
          {[
            { v: "units", l: `Units (${units.length})` },
            { v: "photos", l: `Photos (${photoCount})` },
            { v: "documents", l: `Documents (${docCount})` },
            { v: "history", l: "Status history" },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none px-4 py-3 text-xs uppercase tracking-wider"
            >
              {t.l}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* UNITS */}
        <TabsContent value="units" className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="label-eyebrow">All units</div>
            {canEdit && (
              <Button variant="gold" size="sm" onClick={() => { setEditingUnit(null); setUnitOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> Add unit
              </Button>
            )}
          </div>

          {units.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-8 w-8" strokeWidth={1.2} />}
              title="No units yet"
              description="Add the first unit to this building."
            />
          ) : (
            <div className="border hairline rounded-sm overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b hairline text-left">
                  <tr>
                    <th className="px-4 py-3 label-eyebrow">Code</th>
                    <th className="px-4 py-3 label-eyebrow">Unit</th>
                    <th className="px-4 py-3 label-eyebrow">Type</th>
                    <th className="px-4 py-3 label-eyebrow">Status</th>
                    <th className="px-4 py-3 label-eyebrow text-right">Floor</th>
                    <th className="px-4 py-3 label-eyebrow text-right">Size</th>
                    <th className="px-4 py-3 label-eyebrow text-right">Beds/Baths</th>
                    {canEdit && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => navigate(`/properties/${building.id}/units/${u.id}`)}
                      className="border-b hairline last:border-0 hover:bg-muted/30 cursor-pointer"
                    >
                      <td className="px-4 py-3 ref-code">{u.ref_code}</td>
                      <td className="px-4 py-3 font-medium text-architect">{u.unit_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatEnumLabel(u.unit_type)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={u.status} />
                          {u.status === "occupied" && !u.status_locked_by_lease_id && (
                            <span
                              title="Missing lease details"
                              className="h-1.5 w-1.5 rounded-full bg-amber-500"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right mono text-xs">{u.floor ?? "—"}</td>
                      <td className="px-4 py-3 text-right mono text-xs">{formatSize(u)}</td>
                      <td className="px-4 py-3 text-right mono text-xs">
                        {(u.bedrooms ?? "—") + " / " + (u.bathrooms ?? "—")}
                      </td>
                      {canEdit && (
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => { setEditingUnit(u); setUnitOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* PHOTOS */}
        <TabsContent value="photos" className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="label-eyebrow">Image gallery</div>
            {canEdit && (
              <label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, true)}
                />
                <Button variant="gold" size="sm" asChild>
                  <span className="cursor-pointer"><Upload className="h-3.5 w-3.5" /> Upload photos</span>
                </Button>
              </label>
            )}
          </div>
          {photos.length === 0 ? (
            <EmptyState icon={<ImageIcon className="h-8 w-8" strokeWidth={1.2} />} title="No photos yet" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {photos.map((p) => (
                <div key={p.id} className="relative group aspect-square overflow-hidden border hairline rounded-sm">
                  <img src={getPhotoUrl(p.file_path)} alt={p.name} className="h-full w-full object-cover" />
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteFile(p)}
                      className="absolute top-2 right-2 h-7 w-7 bg-architect/80 text-chalk rounded-sm opacity-0 group-hover:opacity-100 flex items-center justify-center"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="label-eyebrow">Documents</div>
            {canEdit && (
              <label>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, false)}
                />
                <Button variant="gold" size="sm" asChild>
                  <span className="cursor-pointer"><Upload className="h-3.5 w-3.5" /> Upload documents</span>
                </Button>
              </label>
            )}
          </div>
          {docs.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" strokeWidth={1.2} />} title="No documents yet" />
          ) : (
            <div className="border hairline rounded-sm divide-y divide-warm-stone/60 bg-card">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-true-taupe shrink-0" />
                    <div className="min-w-0">
                      <button
                        onClick={async () => {
                          const url = await getDocUrl(d.file_path);
                          if (url) window.open(url, "_blank");
                        }}
                        className="text-sm text-architect hover:text-gold truncate text-left"
                      >
                        {d.name}
                      </button>
                      <div className="ref-code">{format(new Date(d.created_at), "MMM d, yyyy")}</div>
                    </div>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteFile(d)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="pt-6">
          <div className="label-eyebrow mb-4">Status history</div>
          {history.length === 0 ? (
            <EmptyState title="No status changes yet" description="Changes to unit status will appear here." />
          ) : (
            <div className="space-y-2">
              {history.map((h: any) => (
                <div key={h.id} className="flex items-center gap-4 px-4 py-3 border hairline rounded-sm bg-card">
                  <div className="ref-code shrink-0">
                    {format(new Date(h.changed_at), "MMM d, yyyy · HH:mm")}
                  </div>
                  <div className="font-medium text-architect">Unit {h.units?.unit_number}</div>
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
      </Tabs>

      <BuildingFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={building}
        onSaved={() => { setEditOpen(false); load(); }}
      />
      <UnitFormDialog
        open={unitOpen}
        onOpenChange={setUnitOpen}
        buildingId={building.id}
        parentBuildingType={building.building_type}
        initial={editingUnit ?? undefined}
        onSaved={(created) => {
          setUnitOpen(false);
          setEditingUnit(null);
          load();
          if (created && !editingUnit && created.status === "occupied") {
            setLeasePrompt({ unitId: created.id });
          }
        }}
      />

      <AlertDialog open={!!leasePrompt} onOpenChange={(v) => !v && setLeasePrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add lease details?</AlertDialogTitle>
            <AlertDialogDescription>
              This unit is marked Occupied. Add the lease details now so the system reflects reality.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeasePrompt(null)}>Later</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLeasePrompt(null);
                toast("Lease creation coming soon");
              }}
              className="bg-gold text-architect hover:bg-gold/90"
            >
              Add lease
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Meta({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card p-4">
      <div className="label-eyebrow flex items-center gap-1.5">{icon} {label}</div>
      <div className="font-display text-xl text-architect mt-1">{value}</div>
    </div>
  );
}
