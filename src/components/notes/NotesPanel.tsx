import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/EmptyState";
import { StickyNote, Pencil, Trash2, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type EntityType = "building" | "unit" | "contract" | "ticket" | "person" | "vendor";

interface Note {
  id: string;
  body: string;
  author_id: string | null;
  created_at: string;
  updated_at: string | null;
}

interface AuthorMeta {
  id: string;
  email: string | null;
}

interface NotesPanelProps {
  entityType: EntityType;
  entityId: string;
  onCountChange?: (count: number) => void;
}

const MAX_LEN = 4000;

function initialsFromEmail(email: string | null | undefined) {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return letters.toUpperCase();
}

function nameFromEmail(email: string | null | undefined) {
  if (!email) return "Unknown";
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ") || email;
}

function linkifyAndBreak(body: string) {
  const urlRe = /(https?:\/\/[^\s]+)/g;
  // Split into lines first to preserve line breaks, then linkify each line.
  const lines = body.split(/\n/);
  return lines.map((line, li) => {
    const parts: Array<string | { url: string }> = [];
    let lastIdx = 0;
    line.replace(urlRe, (match, _g, idx: number) => {
      if (idx > lastIdx) parts.push(line.slice(lastIdx, idx));
      parts.push({ url: match });
      lastIdx = idx + match.length;
      return match;
    });
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    return (
      <span key={li}>
        {parts.map((p, i) =>
          typeof p === "string" ? (
            <span key={i}>{p}</span>
          ) : (
            <a
              key={i}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-architect underline decoration-gold/60 underline-offset-2 hover:decoration-gold break-all"
            >
              {p.url}
            </a>
          ),
        )}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

export function NotesPanel({ entityType, entityId, onCountChange }: NotesPanelProps) {
  const { user, canEdit, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [notes, setNotes] = useState<Note[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorMeta>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Note[];
    setNotes(rows);
    onCountChange?.(rows.length);

    // Resolve author metadata via user_roles → auth users isn't directly queryable.
    // Best-effort: just include current user; otherwise show generic label.
    if (user) {
      setAuthors((a) => ({ ...a, [user.id]: { id: user.id, email: user.email ?? null } }));
    }
    setLoading(false);
  }, [entityType, entityId, onCountChange, user]);

  useEffect(() => {
    load();
  }, [load]);

  const remaining = MAX_LEN - draft.length;

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body) return;
    if (body.length > MAX_LEN) {
      toast.error(`Note is too long (max ${MAX_LEN} chars).`);
      return;
    }
    if (!user) {
      toast.error("You must be signed in to add a note.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("notes").insert({
      entity_type: entityType,
      entity_id: entityId,
      body,
      author_id: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    toast.success("Note added.");
    load();
  };

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setEditingBody(n.body);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const body = editingBody.trim();
    if (!body) {
      toast.error("Note cannot be empty.");
      return;
    }
    if (body.length > MAX_LEN) {
      toast.error(`Note is too long (max ${MAX_LEN} chars).`);
      return;
    }
    const { error } = await supabase
      .from("notes")
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", editingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingId(null);
    setEditingBody("");
    toast.success("Note updated.");
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("notes").delete().eq("id", deleteId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDeleteId(null);
    toast.success("Note deleted.");
    load();
  };

  const composer = useMemo(() => {
    if (!canEdit) return null;
    return (
      <div className="border hairline rounded-sm bg-card p-4 space-y-3">
        <div className="label-eyebrow">Add a note</div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
          placeholder={`Track internal context about this ${entityType}…`}
          className="min-h-[88px] resize-y"
          maxLength={MAX_LEN}
        />
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "text-[11px] mono",
              remaining < 200 ? "text-amber-700" : "text-muted-foreground",
            )}
          >
            {remaining} characters left
          </div>
          <Button
            variant="gold"
            size="sm"
            onClick={handleSubmit}
            disabled={!draft.trim() || submitting}
          >
            {submitting ? "Adding…" : "Add note"}
          </Button>
        </div>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, submitting, canEdit, entityType, remaining]);

  return (
    <div className="space-y-6">
      {composer}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/40 animate-pulse rounded-sm" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<StickyNote className="h-8 w-8" strokeWidth={1.2} />}
          title="No notes yet"
          description={`Add the first one to track internal context about this ${entityType}.`}
        />
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const author = n.author_id ? authors[n.author_id] : undefined;
            const isAuthor = !!user && n.author_id === user.id;
            const canMutate = isAuthor || isAdmin;
            const isEditing = editingId === n.id;
            const displayName = author ? nameFromEmail(author.email) : "Team member";
            const initials = initialsFromEmail(author?.email);
            const editedSuffix =
              n.updated_at && new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 1000
                ? " · edited"
                : "";
            return (
              <div key={n.id} className="border hairline rounded-sm bg-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-[11px] font-medium text-architect">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-sm font-medium text-architect truncate">
                          {displayName}
                        </span>
                        <span className="text-[11px] text-muted-foreground mono shrink-0">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          {editedSuffix}
                        </span>
                      </div>
                      {canMutate && !isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(n)}
                            title="Edit note"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeleteId(n.id)}
                            title="Delete note"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editingBody}
                          onChange={(e) => setEditingBody(e.target.value.slice(0, MAX_LEN))}
                          className="min-h-[80px] resize-y"
                          maxLength={MAX_LEN}
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(null);
                              setEditingBody("");
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                          <Button variant="gold" size="sm" onClick={saveEdit}>
                            <Check className="h-3.5 w-3.5" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-sm text-architect leading-relaxed whitespace-pre-wrap break-words">
                        {linkifyAndBreak(n.body)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
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