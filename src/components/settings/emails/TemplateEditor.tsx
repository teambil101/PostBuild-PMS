import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Save, RotateCcw, Loader2, Braces, Copy, Check } from "lucide-react";
import { BlockEditor } from "./BlockEditor";
import { EmailPreview } from "./EmailPreview";
import { CATEGORY_VARIABLES, type EmailBlock } from "@/lib/email-blocks";
import { useEmailBrand, rowToBrand } from "@/hooks/useEmailBrand";
import { useUpdateEmailTemplate, useResetEmailTemplate, type EmailTemplateRow } from "@/hooks/useEmailTemplates";
import { TemplateAttachmentsPanel } from "./TemplateAttachmentsPanel";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  template: EmailTemplateRow;
  onBack: () => void;
}

export function TemplateEditor({ template, onBack }: Props) {
  const { data: brandRow } = useEmailBrand();
  const brand = rowToBrand(brandRow ?? null);
  const update = useUpdateEmailTemplate();
  const reset = useResetEmailTemplate();

  const [subject, setSubject] = useState(template.subject);
  const [preheader, setPreheader] = useState(template.preheader || "");
  const [blocks, setBlocks] = useState<EmailBlock[]>(template.blocks);

  useEffect(() => {
    setSubject(template.subject);
    setPreheader(template.preheader || "");
    setBlocks(template.blocks);
  }, [template]);

  const variables = (CATEGORY_VARIABLES[template.category] || []).map((v) => ({ key: v.key, label: v.label }));
  const variablesFull = CATEGORY_VARIABLES[template.category] || [];

  const save = async () => {
    try {
      await update.mutateAsync({ id: template.id, patch: { subject, preheader, blocks } });
      toast.success("Template saved");
    } catch (err) {
      toast.error("Save failed", { description: err instanceof Error ? err.message : "Unknown" });
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset this template to its default content? Your edits will be lost.")) return;
    try {
      await reset.mutateAsync(template.template_key);
      toast.success("Reset to default");
      onBack();
    } catch (err) {
      toast.error("Reset failed", { description: err instanceof Error ? err.message : "Unknown" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{template.name}</h2>
            <p className="text-xs text-muted-foreground font-mono">{template.template_key}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {template.is_system && (
            <Button variant="outline" size="sm" onClick={handleReset} disabled={reset.isPending}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset to default
            </Button>
          )}
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Save className="h-3.5 w-3.5 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Subject line</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Preheader (preview text)</Label>
          <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} />
        </div>
      </div>

      <Tabs defaultValue="design" className="w-full">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
          </TabsList>
          <VariablesPopover variables={variablesFull} />
        </div>

        <TabsContent value="design" className="space-y-4 mt-4">
          <BlockEditor blocks={blocks} onChange={setBlocks} variables={variables} />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <div className="text-xs text-muted-foreground mb-2">
            Preview uses sample data ({variables.length} variable{variables.length !== 1 ? "s" : ""}). Open “Variables” to copy any token.
          </div>
          <EmailPreview blocks={blocks} brand={brand} preheader={preheader} category={template.category} />
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          <TemplateAttachmentsPanel template={template} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VariablesPopover({ variables }: { variables: { key: string; label: string; example: string }[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string) => {
    const token = `{{${key}}}`;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(key);
      toast.success(`Copied ${token}`);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Braces className="h-3.5 w-3.5 mr-1.5" />
          Variables
          <span className="ml-1.5 text-xs text-muted-foreground">{variables.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="text-xs font-semibold uppercase tracking-wider">Available variables</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Click to copy. Paste anywhere in subject, preheader, or block text.
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {variables.length === 0 && (
            <div className="px-3 py-6 text-xs text-muted-foreground text-center">No variables for this category.</div>
          )}
          {variables.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => copy(v.key)}
              className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors flex items-start gap-2 group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-architect truncate">{`{{${v.key}}}`}</div>
                <div className="text-[11px] text-muted-foreground truncate">{v.label} — e.g. {v.example}</div>
              </div>
              {copied === v.key ? (
                <Check className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}