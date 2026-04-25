import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useEmailBrand, useUpsertEmailBrand, type EmailBrandRow } from "@/hooks/useEmailBrand";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

export function EmailBrandForm() {
  const { activeWorkspace } = useWorkspace();
  const { data: brand } = useEmailBrand();
  const upsert = useUpsertEmailBrand();
  const [form, setForm] = useState<Partial<EmailBrandRow>>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (brand) setForm(brand);
  }, [brand]);

  const set = <K extends keyof EmailBrandRow>(k: K, v: EmailBrandRow[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogo = async (file: File) => {
    if (!activeWorkspace) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${activeWorkspace.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("email-brand").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("email-brand").getPublicUrl(path);
      set("logo_url", pub.publicUrl);
      set("logo_storage_path", path);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error("Upload failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    try {
      await upsert.mutateAsync(form);
      toast.success("Brand saved");
    } catch (err) {
      toast.error("Save failed", { description: err instanceof Error ? err.message : "Unknown" });
    }
  };

  const Color = ({ k, label }: { k: keyof EmailBrandRow; label: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={(form[k] as string) || "#000000"}
          onChange={(e) => set(k, e.target.value as never)}
          className="h-9 w-12 rounded-sm border border-input cursor-pointer"
        />
        <Input value={(form[k] as string) || ""} onChange={(e) => set(k, e.target.value as never)} className="font-mono text-xs" />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-architect">Brand identity</h3>
          <p className="text-xs text-muted-foreground mt-1">Applied to every email by default. Individual templates can override.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Company name</Label>
            <Input value={form.company_name || ""} onChange={(e) => set("company_name", e.target.value)} placeholder="Post Build" />
          </div>
          <div className="space-y-1.5">
            <Label>From name</Label>
            <Input value={form.from_name || ""} onChange={(e) => set("from_name", e.target.value)} placeholder="Post Build" />
          </div>
          <div className="space-y-1.5">
            <Label>Reply-to email</Label>
            <Input type="email" value={form.reply_to_email || ""} onChange={(e) => set("reply_to_email", e.target.value)} placeholder="hello@yourdomain.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              {form.logo_url && <img src={form.logo_url} alt="logo" className="h-9 w-9 object-contain rounded-sm border border-border bg-white" />}
              <label className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-sm border border-input cursor-pointer hover:bg-muted/50">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0])} />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-architect">Colors</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Color k="primary_color" label="Primary" />
          <Color k="accent_color" label="Accent" />
          <Color k="background_color" label="Background" />
          <Color k="text_color" label="Text" />
          <Color k="muted_text_color" label="Muted text" />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-architect">Typography</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Body font stack</Label>
            <Input value={form.font_family || ""} onChange={(e) => set("font_family", e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>Heading font stack</Label>
            <Input value={form.heading_font_family || ""} onChange={(e) => set("heading_font_family", e.target.value)} className="font-mono text-xs" placeholder="'Cormorant Garamond', serif" />
          </div>
          <div className="space-y-1.5">
            <Label>Border radius (px)</Label>
            <Input type="number" min={0} max={24} value={form.border_radius_px ?? 2} onChange={(e) => set("border_radius_px", Number(e.target.value))} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-architect">Footer & compliance</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Company address (CAN-SPAM)</Label>
            <Textarea rows={2} value={form.company_address || ""} onChange={(e) => set("company_address", e.target.value)} placeholder="DIFC, Dubai, United Arab Emirates" />
          </div>
          <div className="space-y-1.5">
            <Label>Footer text</Label>
            <Textarea rows={2} value={form.footer_text || ""} onChange={(e) => set("footer_text", e.target.value)} placeholder="© Post Build. All rights reserved." />
          </div>
          <div className="space-y-1.5">
            <Label>Unsubscribe URL</Label>
            <Input value={form.unsubscribe_url || ""} onChange={(e) => set("unsubscribe_url", e.target.value)} placeholder="https://app.postbuild.com/unsubscribe" />
          </div>
          <div className="flex items-center justify-between rounded-sm border border-border p-3">
            <div>
              <Label className="text-sm">Show unsubscribe link</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Required by CAN-SPAM and similar laws.</p>
            </div>
            <Switch checked={form.show_unsubscribe ?? true} onCheckedChange={(v) => set("show_unsubscribe", v)} />
          </div>
          <div className="flex items-center justify-between rounded-sm border border-border p-3">
            <div>
              <Label className="text-sm">Show "Sent via Post Build"</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Helps your tenants discover the platform.</p>
            </div>
            <Switch checked={form.show_powered_by ?? true} onCheckedChange={(v) => set("show_powered_by", v)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-architect">Social links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input placeholder="Website" value={form.social_website || ""} onChange={(e) => set("social_website", e.target.value)} />
          <Input placeholder="LinkedIn URL" value={form.social_linkedin || ""} onChange={(e) => set("social_linkedin", e.target.value)} />
          <Input placeholder="Instagram URL" value={form.social_instagram || ""} onChange={(e) => set("social_instagram", e.target.value)} />
          <Input placeholder="Facebook URL" value={form.social_facebook || ""} onChange={(e) => set("social_facebook", e.target.value)} />
          <Input placeholder="X / Twitter URL" value={form.social_x || ""} onChange={(e) => set("social_x", e.target.value)} />
        </div>
      </section>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={save} disabled={upsert.isPending}>
          {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
          Save brand
        </Button>
      </div>
    </div>
  );
}