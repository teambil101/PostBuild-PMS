import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image as ImageIcon, Star, Trash2, Pencil, ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { FileDropZone, validateFile } from "./FileDropZone";
import {
  PHOTO_ACCEPT, PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_MAX_PER_ENTITY, PHOTO_MIMES,
  buildPhotoPath, getSignedPhotoUrl, invalidateSignedUrl,
  type EntityType,
} from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PhotoRow {
  id: string;
  storage_path: string;
  file_name: string;
  caption: string | null;
  is_cover: boolean;
  sort_order: number;
  mime_type: string;
  file_size_bytes: number;
}

interface Props {
  entityType: EntityType;
  entityId: string;
  editable?: boolean;
  onCountChange?: (n: number) => void;
}

export function PhotoGallery({ entityType, entityId, editable, onCountChange }: Props) {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState<{ id: string; value: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PhotoRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as PhotoRow[];
    setPhotos(rows);
    onCountChange?.(rows.length);
    // Resolve signed URLs in parallel (cached 12h)
    const entries = await Promise.all(
      rows.map(async (p) => [p.id, (await getSignedPhotoUrl(p.storage_path)) ?? ""] as const),
    );
    setUrls(Object.fromEntries(entries));
    setLoading(false);
  }, [entityType, entityId, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (files: File[]) => {
    if (photos.length + files.length > PHOTO_MAX_PER_ENTITY) {
      toast.error(`Max ${PHOTO_MAX_PER_ENTITY} photos per item.`);
      return;
    }
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    let success = 0;
    let failed = 0;
    const hasCover = photos.some((p) => p.is_cover);
    let assignCover = !hasCover;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const err = validateFile(file, PHOTO_MIMES, PHOTO_MAX_BYTES);
      if (err) { toast.error(err); failed++; continue; }

      const id = crypto.randomUUID();
      const path = buildPhotoPath(entityType, entityId, id, file.name);
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) { toast.error(`${file.name}: ${upErr.message}`); failed++; continue; }

      const { error: dbErr } = await supabase.from("photos").insert({
        id,
        entity_type: entityType,
        entity_id: entityId,
        storage_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        is_cover: assignCover,
        sort_order: (photos.length + success) * 10,
        uploaded_by: u.user?.id,
      });
      if (dbErr) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        toast.error(dbErr.message);
        failed++;
        continue;
      }
      assignCover = false;
      success++;
    }
    setUploading(false);
    if (success > 0) toast.success(`${success} photo${success === 1 ? "" : "s"} uploaded.`);
    if (failed > 0 && success === 0) toast.error(`${failed} upload${failed === 1 ? "" : "s"} failed.`);
    await load();
  };

  const handleSetCover = async (photo: PhotoRow) => {
    if (photo.is_cover) return;
    // Clear current cover, then set new — partial unique index requires sequential ops.
    const { error: clearErr } = await supabase
      .from("photos")
      .update({ is_cover: false })
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("is_cover", true);
    if (clearErr) { toast.error(clearErr.message); return; }
    const { error } = await supabase.from("photos").update({ is_cover: true }).eq("id", photo.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cover updated.");
    load();
  };

  const handleSaveCaption = async () => {
    if (!editingCaption) return;
    const { error } = await supabase
      .from("photos")
      .update({ caption: editingCaption.value.trim() || null })
      .eq("id", editingCaption.id);
    if (error) { toast.error(error.message); return; }
    setEditingCaption(null);
    toast.success("Caption saved.");
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.storage.from(PHOTO_BUCKET).remove([deleteTarget.storage_path]);
    invalidateSignedUrl(PHOTO_BUCKET, deleteTarget.storage_path);
    const { error } = await supabase.from("photos").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    setDeleteTarget(null);
    toast.success("Photo deleted.");
    load();
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted/40 animate-pulse rounded-sm" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {editable && (
        <FileDropZone
          accept={PHOTO_ACCEPT}
          onFiles={handleUpload}
          compact={photos.length > 0}
          helperText={
            <>JPG, PNG, WebP or HEIC. Max 10 MB each. {photos.length}/{PHOTO_MAX_PER_ENTITY} used.</>
          }
        />
      )}
      {uploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
        </div>
      )}

      {photos.length === 0 ? (
        !editable && (
          <EmptyState
            icon={<ImageIcon className="h-8 w-8" strokeWidth={1.2} />}
            title="No photos yet"
          />
        )
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map((p, idx) => (
            <div
              key={p.id}
              className="relative group aspect-square overflow-hidden border hairline rounded-sm bg-muted/40"
            >
              {urls[p.id] ? (
                <img
                  src={urls[p.id]}
                  alt={p.caption ?? p.file_name}
                  className="h-full w-full object-cover cursor-zoom-in"
                  onClick={() => setLightboxIndex(idx)}
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-true-taupe">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              {p.is_cover && (
                <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-gold-deep text-white text-[9px] uppercase tracking-wider rounded-sm flex items-center gap-1">
                  <Star className="h-2.5 w-2.5 fill-current" /> Cover
                </span>
              )}
              {p.caption && !editable && (
                <div className="absolute bottom-0 inset-x-0 bg-architect/70 text-chalk text-[11px] px-2 py-1 truncate">
                  {p.caption}
                </div>
              )}
              {editable && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-architect/60 flex flex-col">
                  <div className="ml-auto p-1.5 flex gap-1">
                    {!p.is_cover && (
                      <button
                        onClick={() => handleSetCover(p)}
                        title="Set as cover"
                        className="h-7 w-7 bg-chalk/90 text-architect rounded-sm flex items-center justify-center hover:bg-chalk"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setEditingCaption({ id: p.id, value: p.caption ?? "" })}
                      title="Edit caption"
                      className="h-7 w-7 bg-chalk/90 text-architect rounded-sm flex items-center justify-center hover:bg-chalk"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      title="Delete"
                      className="h-7 w-7 bg-destructive text-destructive-foreground rounded-sm flex items-center justify-center hover:opacity-90"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {p.caption && (
                    <div className="mt-auto px-2 py-1 text-chalk text-[11px] truncate">{p.caption}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <Lightbox
          photo={photos[lightboxIndex]}
          url={urls[photos[lightboxIndex].id]}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < photos.length - 1}
          onPrev={() => setLightboxIndex((i) => (i ?? 0) - 1)}
          onNext={() => setLightboxIndex((i) => (i ?? 0) + 1)}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Caption editor */}
      <AlertDialog open={!!editingCaption} onOpenChange={(v) => !v && setEditingCaption(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit caption</AlertDialogTitle>
            <AlertDialogDescription>Short description shown under the photo.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={editingCaption?.value ?? ""}
            onChange={(e) => setEditingCaption((s) => (s ? { ...s, value: e.target.value.slice(0, 200) } : s))}
            placeholder="e.g. Living room view"
            maxLength={200}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveCaption} className="bg-gold-deep text-white hover:bg-gold-deep/90">
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
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

function Lightbox({
  photo, url, hasPrev, hasNext, onPrev, onNext, onClose,
}: {
  photo: PhotoRow; url: string;
  hasPrev: boolean; hasNext: boolean;
  onPrev: () => void; onNext: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-architect/95 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 h-10 w-10 rounded-sm bg-chalk/10 text-chalk flex items-center justify-center hover:bg-chalk/20"
      >
        <X className="h-5 w-5" />
      </button>
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 h-12 w-12 rounded-sm bg-chalk/10 text-chalk flex items-center justify-center hover:bg-chalk/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 h-12 w-12 rounded-sm bg-chalk/10 text-chalk flex items-center justify-center hover:bg-chalk/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      <img
        src={url}
        alt={photo.caption ?? photo.file_name}
        className={cn("max-h-[85vh] max-w-[85vw] object-contain shadow-2xl")}
        onClick={(e) => e.stopPropagation()}
      />
      {photo.caption && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-architect/80 text-chalk text-sm rounded-sm max-w-2xl text-center">
          {photo.caption}
        </div>
      )}
    </div>
  );
}