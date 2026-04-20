import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, Building2, Image as ImageIcon, FileText, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { BuildingFormDialog } from "@/components/properties/BuildingFormDialog";
import { UnitFormDialog } from "@/components/properties/UnitFormDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { COUNTRY_BY_CODE } from "@/lib/countries";
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
  status: "vacant" | "occupied" | "maintenance" | "off_market";
  floor: number | null;
  size_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  monthly_rent: number | null;
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = useAuth();

  const [building, setBuilding] = useState<Building | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [b, u, d, h] = await Promise.all([
      supabase.from("buildings").select("*").eq("id", id).maybeSingle(),
      supabase.from("units").select("*").eq("building_id", id).order("unit_number"),
      supabase.from("property_documents").select("*").eq("building_id", id).order("created_at", { ascending: false }),
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
    const allDocs = d.data ?? [];
    setPhotos(allDocs.filter((x: any) => x.is_image));
    setDocs(allDocs.filter((x: any) => !x.is_image));
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    if (!e.target.files || !building) return;
    const files = Array.from(e.target.files);
    const bucket = isImage ? "property-photos" : "property-docs";
    for (const file of files) {
      const path = `${building.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file);
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        continue;
      }
      const { data: u } = await supabase.auth.getUser();
      const { error: dbErr } = await supabase.from("property_documents").insert({
        building_id: building.id,
        name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        is_image: isImage,
        uploaded_by: u.user?.id,
      });
      if (dbErr) toast.error(dbErr.message);
    }
    e.target.value = "";
    toast.success("Upload complete.");
    load();
  };

  const handleDeleteFile = async (doc: any) => {
    const bucket = doc.is_image ? "property-photos" : "property-docs";
    await supabase.storage.from(bucket).remove([doc.file_path]);
    const { error } = await supabase.from("property_documents").delete().eq("id", doc.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted."); load(); }
  };

  const getPhotoUrl = (path: string) =>
    supabase.storage.from("property-photos").getPublicUrl(path).data.publicUrl;

  const getDocUrl = async (path: string) => {
    const { data } = await supabase.storage.from("property-docs").createSignedUrl(path, 60);
    return data?.signedUrl;
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

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate("/properties")} className="mb-4">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to properties
      </Button>

      <PageHeader
        eyebrow={`Building · ${building.ref_code}`}
        title={building.name}
        description={building.address}
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

      {/* Meta strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-warm-stone/60 border hairline rounded-sm overflow-hidden mb-10">
        <Meta label="Location" value={[building.city, COUNTRY_BY_CODE[building.country] ?? building.country].filter(Boolean).join(", ") || "—"} icon={<MapPin className="h-3.5 w-3.5" />} />
        <Meta label="Type" value={building.building_type?.replace(/_/g, " ") ?? "—"} icon={<Building2 className="h-3.5 w-3.5" />} />
        <Meta label="Community" value={building.community ?? "—"} icon={<MapPin className="h-3.5 w-3.5" />} />
        <Meta label="Units" value={units.length.toString()} icon={<Building2 className="h-3.5 w-3.5" />} />
      </div>

      <Tabs defaultValue="units" className="w-full">
        <TabsList className="bg-transparent border-b hairline rounded-none w-full justify-start gap-0 h-auto p-0">
          {[
            { v: "units", l: `Units (${units.length})` },
            { v: "photos", l: `Photos (${photos.length})` },
            { v: "documents", l: `Documents (${docs.length})` },
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
                    <tr key={u.id} className="border-b hairline last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 ref-code">{u.ref_code}</td>
                      <td className="px-4 py-3 font-medium text-architect">{u.unit_number}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{u.unit_type}</td>
                      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-4 py-3 text-right mono text-xs">{u.floor ?? "—"}</td>
                      <td className="px-4 py-3 text-right mono text-xs">{u.size_sqm ? `${u.size_sqm} m²` : "—"}</td>
                      <td className="px-4 py-3 text-right mono text-xs">
                        {(u.bedrooms ?? "—") + " / " + (u.bathrooms ?? "—")}
                      </td>
                      {canEdit && (
                        <td className="px-2 py-3">
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
        initial={editingUnit ?? undefined}
        onSaved={() => { setUnitOpen(false); setEditingUnit(null); load(); }}
      />
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
