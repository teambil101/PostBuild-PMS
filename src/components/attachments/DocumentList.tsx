import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Trash2, Pencil, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { FileDropZone, validateFile } from "./FileDropZone";
import {
  DOC_ACCEPT, DOC_BUCKET, DOC_MAX_BYTES, DOC_MAX_PER_ENTITY,
  buildDocPath, formatBytes, getSignedDocUrl, invalidateSignedUrl,
  type EntityType,
} from "@/lib/storage";
import { formatEnumLabel } from "@/lib/format";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DOC_TYPES = [
  "title_deed", "floor_plan", "inspection_report", "handover_report",
  "ejari", "dewa", "noc", "contract", "invoice", "other",
] as const;
type DocType = typeof DOC_TYPES[number];

interface DocRow {
  id: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  doc_type: DocType;
  title: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface Props {
  entityType: EntityType;
  entityId: string;
  editable?: boolean;
  onCountChange?: (n: number) => void;
}

const ALL_MIMES = null; // accept any with the file picker; rely on max size

export function DocumentList({ entityType, entityId, editable, onCountChange }: Props) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<DocType | "all">("all");
  const [editTarget, setEditTarget] = useState<DocRow | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; doc_type: DocType }>({ title: "", doc_type: "other" });
  const [deleteTarget, setDeleteTarget] = useState<DocRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as DocRow[];
    setDocs(rows);
    onCountChange?.(rows.length);
    setLoading(false);
  }, [entityType, entityId, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => filter === "all" ? docs : docs.filter((d) => d.doc_type === filter),
    [docs, filter],
  );

  const handleUpload = async (files: File[]) => {
    if (docs.length + files.length > DOC_MAX_PER_ENTITY) {
      toast.error(`Max ${DOC_MAX_PER_ENTITY} documents per item.`);
      return;
    }
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    let success = 0;
    let failed = 0;

    for (const file of files) {
      const err = validateFile(file, ALL_MIMES, DOC_MAX_BYTES);
      if (err) { toast.error(err); failed++; continue; }

      const id = crypto.randomUUID();
      const path = buildDocPath(entityType, entityId, id, file.name);
      const { error: upErr } = await supabase.storage.from(DOC_BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) { toast.error(`${file.name}: ${upErr.message}`); failed++; continue; }

      const { error: dbErr } = await supabase.from("documents").insert({
        id,
        entity_type: entityType,
        entity_id: entityId,
        storage_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type || "application/octet-stream",
        doc_type: "other",
        uploaded_by: u.user?.id,
      });
      if (dbErr) {
        await supabase.storage.from(DOC_BUCKET).remove([path]);
        toast.error(dbErr.message);
        failed++;
        continue;
      }
      success++;
    }
    setUploading(false);
    if (success > 0) toast.success(`${success} document${success === 1 ? "" : "s"} uploaded.`);
    if (failed > 0 && success === 0) toast.error(`${failed} upload${failed === 1 ? "" : "s"} failed.`);
    await load();
  };

  const handleDownload = async (d: DocRow) => {
    const url = await getSignedDocUrl(d.storage_path);
    if (!url) { toast.error("Could not generate download link."); return; }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openEdit = (d: DocRow) => {
    setEditTarget(d);
    setEditForm({ title: d.title ?? d.file_name, doc_type: d.doc_type });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const { error } = await supabase
      .from("documents")
      .update({ title: editForm.title.trim() || null, doc_type: editForm.doc_type })
      .eq("id", editTarget.id);
    if (error) { toast.error(error.message); return; }
    setEditTarget(null);
    toast.success("Document updated.");
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.storage.from(DOC_BUCKET).remove([deleteTarget.storage_path]);
    invalidateSignedUrl(DOC_BUCKET, deleteTarget.storage_path);
    const { error } = await supabase.from("documents").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    setDeleteTarget(null);
    toast.success("Document deleted.");
    load();
  };

  if (loading) {
    return <div className="h-32 bg-muted/40 animate-pulse rounded-sm" />;
  }

  return (
    <div className="space-y-4">
      {editable && (
        <FileDropZone
          accept={DOC_ACCEPT}
          onFiles={handleUpload}
          compact={docs.length > 0}
          helperText={
            <>PDF, images, Word, Excel, PPT or text. Max 25 MB each. {docs.length}/{DOC_MAX_PER_ENTITY} used.</>
          }
        />
      )}
      {uploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
        </div>
      )}

      {docs.length === 0 ? (
        !editable && (
          <EmptyState
            icon={<FileText className="h-8 w-8" strokeWidth={1.2} />}
            title="No documents yet"
          />
        )
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="label-eyebrow">Filter</span>
            <Select value={filter} onValueChange={(v) => setFilter(v as DocType | "all")}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{formatEnumLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} of {docs.length}
            </span>
          </div>

          <div className="border hairline rounded-sm overflow-hidden bg-card">
            <div className="table-scroll">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/40 border-b hairline text-left">
                <tr>
                  <th className="px-4 py-3 label-eyebrow">Name</th>
                  <th className="px-4 py-3 label-eyebrow">Type</th>
                  <th className="px-4 py-3 label-eyebrow text-right">Size</th>
                  <th className="px-4 py-3 label-eyebrow">Uploaded</th>
                  {editable && <th className="w-32" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b hairline last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 min-w-0">
                      <button
                        onClick={() => handleDownload(d)}
                        className="flex items-center gap-2 text-left text-architect hover:text-gold-deep min-w-0"
                      >
                        <FileText className="h-4 w-4 text-true-taupe shrink-0" />
                        <span className="truncate">{d.title ?? d.file_name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatEnumLabel(d.doc_type)}</td>
                    <td className="px-4 py-3 text-right mono text-xs">{formatBytes(d.file_size_bytes)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {format(new Date(d.created_at), "MMM d, yyyy")}
                    </td>
                    {editable && (
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(d)} title="Download">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(d)} title="Rename / change type">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(d)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={editable ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No documents match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {/* Edit modal */}
      <AlertDialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit document</AlertDialogTitle>
            <AlertDialogDescription>Update the display name and category.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-architect">Title</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value.slice(0, 200) }))}
                placeholder={editTarget?.file_name ?? ""}
                className="mt-1"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-architect">Type</label>
              <Select
                value={editForm.doc_type}
                onValueChange={(v) => setEditForm((s) => ({ ...s, doc_type: v as DocType }))}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{formatEnumLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveEdit} className="bg-gold-deep text-white hover:bg-gold-deep/90">
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.title ?? deleteTarget?.file_name} — this cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}