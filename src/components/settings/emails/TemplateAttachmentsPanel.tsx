import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Upload, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { EmailTemplateRow } from "@/hooks/useEmailTemplates";
import { toast } from "sonner";

interface StaticAtt {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
}

interface DynAtt {
  id: string;
  generator_key: string;
  filename_pattern: string | null;
  enabled: boolean;
}

const DYNAMIC_GENERATORS: Record<string, { label: string; categories: string[]; description: string }> = {
  invoice_pdf: {
    label: "Generated invoice PDF",
    categories: ["alert", "notice", "confirmation"],
    description: "Attaches the relevant invoice as a PDF at send-time.",
  },
  quote_summary_pdf: {
    label: "Quote summary PDF",
    categories: ["quote"],
    description: "Attaches the work request brief as a PDF.",
  },
  lease_pdf: {
    label: "Signed lease PDF",
    categories: ["confirmation", "notice"],
    description: "Attaches the executed lease document.",
  },
  receipt_pdf: {
    label: "Payment receipt PDF",
    categories: ["confirmation"],
    description: "Attaches the payment receipt.",
  },
};

export function TemplateAttachmentsPanel({ template }: { template: EmailTemplateRow }) {
  const { activeWorkspace } = useWorkspace();
  const [statics, setStatics] = useState<StaticAtt[]>([]);
  const [dyn, setDyn] = useState<DynAtt[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const [a, b] = await Promise.all([
      supabase.from("email_template_attachments").select("*").eq("template_id", template.id),
      supabase.from("email_template_dynamic_attachments").select("*").eq("template_id", template.id),
    ]);
    if (a.data) setStatics(a.data as StaticAtt[]);
    if (b.data) setDyn(b.data as DynAtt[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [template.id]);

  const upload = async (file: File) => {
    if (!activeWorkspace) return;
    setUploading(true);
    try {
      const path = `${activeWorkspace.id}/${template.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("email-attachments").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("email_template_attachments").insert({
        template_id: template.id,
        workspace_id: activeWorkspace.id,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || "application/octet-stream",
        file_size_bytes: file.size,
      });
      if (insErr) throw insErr;
      toast.success("Attachment uploaded");
      load();
    } catch (err) {
      toast.error("Upload failed", { description: err instanceof Error ? err.message : "Unknown" });
    } finally {
      setUploading(false);
    }
  };

  const removeStatic = async (id: string, path: string) => {
    await supabase.storage.from("email-attachments").remove([path]);
    await supabase.from("email_template_attachments").delete().eq("id", id);
    load();
  };

  const toggleDyn = async (key: string, enabled: boolean) => {
    if (!activeWorkspace) return;
    const existing = dyn.find((d) => d.generator_key === key);
    if (existing) {
      await supabase.from("email_template_dynamic_attachments").update({ enabled }).eq("id", existing.id);
    } else if (enabled) {
      await supabase.from("email_template_dynamic_attachments").insert({
        template_id: template.id,
        workspace_id: activeWorkspace.id,
        generator_key: key,
      });
    }
    load();
  };

  const availableGenerators = Object.entries(DYNAMIC_GENERATORS).filter(([_, g]) => g.categories.includes(template.category));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-architect">Static attachments</h3>
          <p className="text-xs text-muted-foreground mt-1">Files attached to every email sent from this template.</p>
        </div>
        <div className="space-y-2">
          {statics.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-sm border border-border p-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.file_name}</div>
                <div className="text-xs text-muted-foreground">{(a.file_size_bytes / 1024).toFixed(1)} KB · {a.mime_type}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeStatic(a.id, a.storage_path)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {statics.length === 0 && <p className="text-xs text-muted-foreground italic">No static attachments yet.</p>}
        </div>
        <label className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-sm border border-input cursor-pointer hover:bg-muted/50">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload file
          <input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-architect">Dynamic attachments</h3>
          <p className="text-xs text-muted-foreground mt-1">Generated at send-time based on the email's context (e.g. the actual invoice).</p>
        </div>
        {availableGenerators.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No dynamic attachments available for this category.</p>
        )}
        {availableGenerators.map(([key, g]) => {
          const existing = dyn.find((d) => d.generator_key === key);
          return (
            <div key={key} className="flex items-center justify-between rounded-sm border border-border p-3">
              <div className="flex-1">
                <Label className="text-sm">{g.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>
              </div>
              <Switch checked={existing?.enabled ?? false} onCheckedChange={(v) => toggleDyn(key, v)} />
            </div>
          );
        })}
      </section>
    </div>
  );
}