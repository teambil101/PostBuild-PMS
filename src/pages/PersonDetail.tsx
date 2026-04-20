import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Building2, Pencil, Trash2, FileText, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { PersonRoleBadge } from "@/components/people/PersonRoleBadge";
import { PersonFormDialog } from "@/components/people/PersonFormDialog";
import { EmptyState } from "@/components/EmptyState";
import { initials } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = useAuth();

  const [person, setPerson] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [p, d] = await Promise.all([
      supabase.from("people").select("*").eq("id", id).maybeSingle(),
      supabase.from("people_documents").select("*").eq("person_id", id).order("created_at", { ascending: false }),
    ]);
    if (p.error || !p.data) {
      toast.error("Person not found.");
      navigate("/people");
      return;
    }
    setPerson(p.data);
    setDocs(d.data ?? []);
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    const { error } = await supabase.from("people").delete().eq("id", person.id);
    if (error) toast.error(error.message);
    else { toast.success("Person deleted."); navigate("/people"); }
  };

  const handleUnlink = async (linkId: string) => {
    const { error } = await supabase.from("people_property_links").delete().eq("id", linkId);
    if (error) toast.error(error.message);
    else { toast.success("Removed."); load(); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      const path = `${person.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("people-docs").upload(path, file);
      if (upErr) { toast.error(upErr.message); continue; }
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("people_documents").insert({
        person_id: person.id,
        name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: u.user?.id,
      });
    }
    e.target.value = "";
    toast.success("Upload complete.");
    load();
  };

  const handleDeleteDoc = async (doc: any) => {
    await supabase.storage.from("people-docs").remove([doc.file_path]);
    await supabase.from("people_documents").delete().eq("id", doc.id);
    toast.success("Deleted.");
    load();
  };

  const getDocUrl = async (path: string) => {
    const { data } = await supabase.storage.from("people-docs").createSignedUrl(path, 60);
    return data?.signedUrl;
  };

  if (loading) return <div className="h-64 bg-muted/40 animate-pulse rounded-sm" />;
  if (!person) return null;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate("/people")} className="mb-4">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to people
      </Button>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 border-b hairline pb-8 mb-8">
        <div className="flex items-start gap-5">
          <div className="h-20 w-20 bg-architect text-chalk flex items-center justify-center rounded-sm text-2xl font-display shrink-0">
            {initials(person.first_name, person.last_name)}
          </div>
          <div>
            <div className="ref-code mb-1.5">{person.ref_code}</div>
            <h1 className="font-display text-4xl text-architect leading-tight">
              {person.first_name} {person.last_name}
            </h1>
            {person.company && <div className="text-sm text-muted-foreground mt-1">{person.company}</div>}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {person.roles?.map((r: string) => <PersonRoleBadge key={r} role={r as any} />)}
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this person?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All property links and documents for this person will be removed.
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
          </div>
        )}
      </div>

      {/* Contact strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-warm-stone/60 border hairline rounded-sm overflow-hidden mb-10">
        <Meta label="Email" icon={<Mail className="h-3.5 w-3.5" />} value={person.email ?? "—"} />
        <Meta label="Phone" icon={<Phone className="h-3.5 w-3.5" />} value={person.phone ?? "—"} />
        <Meta label="Location" icon={<Building2 className="h-3.5 w-3.5" />} value={[person.city, person.country].filter(Boolean).join(", ") || "—"} />
      </div>

      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="bg-transparent border-b hairline rounded-none w-full justify-start gap-0 h-auto p-0">
          {[
            { v: "properties", l: `Properties (${links.length})` },
            { v: "documents", l: `Documents (${docs.length})` },
            { v: "notes", l: "Notes" },
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

        <TabsContent value="properties" className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="label-eyebrow">Property links</div>
            {canEdit && (
              <Button variant="gold" size="sm" onClick={() => setLinkOpen(true)}>
                <Link2 className="h-3.5 w-3.5" /> Link to property
              </Button>
            )}
          </div>
          {links.length === 0 ? (
            <EmptyState title="No property links" description="Connect this person to a building or unit." />
          ) : (
            <div className="space-y-2">
              {links.map((l) => (
                <div key={l.id} className="flex items-center gap-4 px-4 py-3 border hairline rounded-sm bg-card">
                  <Building2 className="h-4 w-4 text-true-taupe shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Link to={`/properties/${l.buildings?.id}`} className="font-display text-base text-architect hover:text-gold">
                      {l.buildings?.name}
                      {l.units && <span className="text-muted-foreground"> · Unit {l.units.unit_number}</span>}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {l.relationship}
                      {l.start_date && ` · since ${format(new Date(l.start_date), "MMM d, yyyy")}`}
                      {l.end_date && ` — ${format(new Date(l.end_date), "MMM d, yyyy")}`}
                    </div>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="icon" onClick={() => handleUnlink(l.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="label-eyebrow">Documents</div>
            {canEdit && (
              <label>
                <input type="file" multiple className="hidden" onChange={handleUpload} />
                <Button variant="gold" size="sm" asChild>
                  <span className="cursor-pointer"><Upload className="h-3.5 w-3.5" /> Upload</span>
                </Button>
              </label>
            )}
          </div>
          {docs.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" strokeWidth={1.2} />} title="No documents" />
          ) : (
            <div className="border hairline rounded-sm divide-y divide-warm-stone/60 bg-card">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-true-taupe shrink-0" />
                    <button
                      onClick={async () => { const url = await getDocUrl(d.file_path); if (url) window.open(url, "_blank"); }}
                      className="text-sm text-architect hover:text-gold truncate text-left"
                    >
                      {d.name}
                    </button>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteDoc(d)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="pt-6">
          <div className="border hairline rounded-sm bg-card p-6 text-sm whitespace-pre-wrap text-foreground/90 min-h-[120px]">
            {person.notes || <span className="text-muted-foreground italic">No notes yet.</span>}
          </div>
        </TabsContent>
      </Tabs>

      <PersonFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={person}
        onSaved={() => { setEditOpen(false); load(); }}
      />
      <LinkToPropertyDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        personId={person.id}
        onSaved={() => { setLinkOpen(false); load(); }}
      />
    </>
  );
}

function Meta({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card p-4">
      <div className="label-eyebrow flex items-center gap-1.5">{icon} {label}</div>
      <div className="text-base text-architect mt-1 truncate">{value}</div>
    </div>
  );
}
