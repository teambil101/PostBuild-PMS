import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  GripVertical,
  Heading1,
  Type,
  Image as ImageIcon,
  Minus,
  StretchVertical,
  AlertCircle,
  Table as TableIcon,
  Square,
  Layout,
} from "lucide-react";
import type { EmailBlock, EmailBlockType, TableRow as TR } from "@/lib/email-blocks";

const newId = () => `b_${Math.random().toString(36).slice(2, 9)}`;

const BLOCK_DEFAULTS: Record<EmailBlockType, () => EmailBlock> = {
  header: () => ({ id: newId(), type: "header", showLogo: true, showCompanyName: true, align: "left" }),
  hero: () => ({ id: newId(), type: "hero", eyebrow: "Eyebrow", headline: "New headline", subheadline: "Supporting text", align: "left", emphasis: "default" }),
  heading: () => ({ id: newId(), type: "heading", text: "Section heading", level: 2, align: "left" }),
  text: () => ({ id: newId(), type: "text", content: "Add your message here. Use **bold** for emphasis and {{variable}} for dynamic values.", align: "left" }),
  button: () => ({ id: newId(), type: "button", label: "Click me", href: "https://", align: "center", variant: "primary" }),
  image: () => ({ id: newId(), type: "image", src: "https://", alt: "", align: "center", widthPx: 480 }),
  divider: () => ({ id: newId(), type: "divider" }),
  spacer: () => ({ id: newId(), type: "spacer", heightPx: 24 }),
  callout: () => ({ id: newId(), type: "callout", title: "", body: "Important information", tone: "info" }),
  table: () => ({ id: newId(), type: "table", title: "Details", rows: [{ label: "Label", value: "Value" }] }),
  footer: () => ({ id: newId(), type: "footer", showSocial: true, showAddress: true, showUnsubscribe: true }),
};

const BLOCK_LABELS: Record<EmailBlockType, { label: string; icon: typeof Layout }> = {
  header: { label: "Header", icon: Layout },
  hero: { label: "Hero", icon: Heading1 },
  heading: { label: "Heading", icon: Heading1 },
  text: { label: "Text", icon: Type },
  button: { label: "Button", icon: Square },
  image: { label: "Image", icon: ImageIcon },
  divider: { label: "Divider", icon: Minus },
  spacer: { label: "Spacer", icon: StretchVertical },
  callout: { label: "Callout", icon: AlertCircle },
  table: { label: "Table", icon: TableIcon },
  footer: { label: "Footer", icon: Layout },
};

interface Props {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
  variables: { key: string; label: string }[];
}

export function BlockEditor({ blocks, onChange, variables }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id ?? null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<EmailBlock>) => {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EmailBlock) : b)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const remove = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const add = (type: EmailBlockType) => {
    const block = BLOCK_DEFAULTS[type]();
    onChange([...blocks, block]);
    setSelectedId(block.id);
  };

  const onDragStart = (id: string) => setDraggingId(id);
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    const from = blocks.findIndex((b) => b.id === draggingId);
    const to = blocks.findIndex((b) => b.id === overId);
    if (from < 0 || to < 0) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  const onDragEnd = () => setDraggingId(null);

  const selected = blocks.find((b) => b.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      {/* Block list */}
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Blocks</div>
        <div className="space-y-1">
          {blocks.map((b, idx) => {
            const meta = BLOCK_LABELS[b.type];
            const Icon = meta.icon;
            const isSelected = selectedId === b.id;
            return (
              <div
                key={b.id}
                draggable
                onDragStart={() => onDragStart(b.id)}
                onDragOver={(e) => onDragOver(e, b.id)}
                onDragEnd={onDragEnd}
                onClick={() => setSelectedId(b.id)}
                className={`flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                  isSelected ? "bg-architect text-chalk border-architect" : "border-border hover:bg-muted/60"
                } ${draggingId === b.id ? "opacity-40" : ""}`}
              >
                <GripVertical className="h-3 w-3 opacity-50" />
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span className="flex-1 truncate">{meta.label}</span>
                <button onClick={(e) => { e.stopPropagation(); move(idx, -1); }} className="p-0.5 hover:opacity-70" disabled={idx === 0}>
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); move(idx, 1); }} className="p-0.5 hover:opacity-70" disabled={idx === blocks.length - 1}>
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); remove(b.id); }} className="p-0.5 hover:opacity-70">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-border space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Add block</div>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(BLOCK_LABELS) as EmailBlockType[]).map((t) => {
              const meta = BLOCK_LABELS[t];
              const Icon = meta.icon;
              return (
                <button
                  key={t}
                  onClick={() => add(t)}
                  className="flex items-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-xs hover:bg-muted/60 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <Icon className="h-3 w-3" strokeWidth={1.5} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected block editor */}
      <div className="rounded-sm border border-border p-4 bg-card min-h-[400px]">
        {!selected && (
          <div className="text-sm text-muted-foreground text-center py-12">Select a block to edit it.</div>
        )}
        {selected && (
          <BlockFieldEditor
            key={selected.id}
            block={selected}
            onChange={(patch) => update(selected.id, patch)}
            variables={variables}
          />
        )}
      </div>
    </div>
  );
}

function VarHint({ variables }: { variables: { key: string; label: string }[] }) {
  if (variables.length === 0) return null;
  return (
    <div className="text-[10px] text-muted-foreground mt-1">
      Available: {variables.map((v) => `{{${v.key}}}`).join("  ·  ")}
    </div>
  );
}

function BlockFieldEditor({
  block,
  onChange,
  variables,
}: {
  block: EmailBlock;
  onChange: (patch: Partial<EmailBlock>) => void;
  variables: { key: string; label: string }[];
}) {
  switch (block.type) {
    case "header":
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Header</h4>
          <div className="flex items-center justify-between rounded-sm border border-border p-3">
            <Label className="text-sm">Show logo</Label>
            <Switch checked={block.showLogo} onCheckedChange={(v) => onChange({ showLogo: v } as never)} />
          </div>
          <div className="flex items-center justify-between rounded-sm border border-border p-3">
            <Label className="text-sm">Show company name</Label>
            <Switch checked={block.showCompanyName} onCheckedChange={(v) => onChange({ showCompanyName: v } as never)} />
          </div>
          <AlignSelect value={block.align} onChange={(v) => onChange({ align: v } as never)} />
        </div>
      );

    case "hero":
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Hero</h4>
          <div className="space-y-1.5">
            <Label>Eyebrow</Label>
            <Input value={block.eyebrow || ""} onChange={(e) => onChange({ eyebrow: e.target.value } as never)} />
          </div>
          <div className="space-y-1.5">
            <Label>Headline</Label>
            <Input value={block.headline} onChange={(e) => onChange({ headline: e.target.value } as never)} />
            <VarHint variables={variables} />
          </div>
          <div className="space-y-1.5">
            <Label>Subheadline</Label>
            <Textarea rows={2} value={block.subheadline || ""} onChange={(e) => onChange({ subheadline: e.target.value } as never)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AlignSelect value={block.align} onChange={(v) => onChange({ align: v } as never)} />
            <div className="space-y-1.5">
              <Label className="text-xs">Emphasis</Label>
              <Select value={block.emphasis || "default"} onValueChange={(v) => onChange({ emphasis: v } as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="danger">Danger</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );

    case "heading":
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Heading</h4>
          <div className="space-y-1.5">
            <Label>Text</Label>
            <Input value={block.text} onChange={(e) => onChange({ text: e.target.value } as never)} />
            <VarHint variables={variables} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Level</Label>
              <Select value={String(block.level)} onValueChange={(v) => onChange({ level: Number(v) } as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">H1</SelectItem>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AlignSelect value={block.align} onChange={(v) => onChange({ align: v } as never)} />
          </div>
        </div>
      );

    case "text":
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Text</h4>
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea rows={6} value={block.content} onChange={(e) => onChange({ content: e.target.value } as never)} />
            <VarHint variables={variables} />
          </div>
          <AlignSelect value={block.align} onChange={(v) => onChange({ align: v } as never)} />
        </div>
      );

    case "button":
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Button</h4>
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input value={block.label} onChange={(e) => onChange({ label: e.target.value } as never)} />
          </div>
          <div className="space-y-1.5">
            <Label>Link URL</Label>
            <Input value={block.href} onChange={(e) => onChange({ href: e.target.value } as never)} />
            <VarHint variables={variables} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AlignSelect value={block.align} onChange={(v) => onChange({ align: v } as never)} />
            <div className="space-y-1.5">
              <Label className="text-xs">Style</Label>
              <Select value={block.variant} onValueChange={(v) => onChange({ variant: v } as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary (gold)</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );

    case "image":
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Image</h4>
          <div className="space-y-1.5">
            <Label>Image URL</Label>
            <Input value={block.src} onChange={(e) => onChange({ src: e.target.value } as never)} />
          </div>
          <div className="space-y-1.5">
            <Label>Alt text</Label>
            <Input value={block.alt} onChange={(e) => onChange({ alt: e.target.value } as never)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Width (px)</Label>
              <Input type="number" value={block.widthPx ?? 480} onChange={(e) => onChange({ widthPx: Number(e.target.value) } as never)} />
            </div>
            <AlignSelect value={block.align} onChange={(v) => onChange({ align: v } as never)} />
          </div>
        </div>
      );

    case "divider":
      return <div className="text-sm text-muted-foreground">Divider has no settings.</div>;

    case "spacer":
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Spacer</h4>
          <div className="space-y-1.5">
            <Label>Height (px)</Label>
            <Input type="number" value={block.heightPx} onChange={(e) => onChange({ heightPx: Number(e.target.value) } as never)} />
          </div>
        </div>
      );

    case "callout":
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Callout</h4>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={block.title || ""} onChange={(e) => onChange({ title: e.target.value } as never)} />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea rows={4} value={block.body} onChange={(e) => onChange({ body: e.target.value } as never)} />
            <VarHint variables={variables} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tone</Label>
            <Select value={block.tone} onValueChange={(v) => onChange({ tone: v } as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info (blue)</SelectItem>
                <SelectItem value="warning">Warning (amber)</SelectItem>
                <SelectItem value="danger">Danger (red)</SelectItem>
                <SelectItem value="success">Success (green)</SelectItem>
                <SelectItem value="neutral">Neutral (grey)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "table": {
      const rows = block.rows;
      const setRows = (r: TR[]) => onChange({ rows: r } as never);
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Table</h4>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={block.title || ""} onChange={(e) => onChange({ title: e.target.value } as never)} />
          </div>
          <div className="space-y-2">
            <Label>Rows</Label>
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Label" value={r.label} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <Input placeholder="Value" value={r.value} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, { label: "", value: "" }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add row
            </Button>
            <VarHint variables={variables} />
          </div>
        </div>
      );
    }

    case "footer":
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Footer</h4>
          <div className="flex items-center justify-between rounded-sm border border-border p-3">
            <Label className="text-sm">Social links</Label>
            <Switch checked={block.showSocial} onCheckedChange={(v) => onChange({ showSocial: v } as never)} />
          </div>
          <div className="flex items-center justify-between rounded-sm border border-border p-3">
            <Label className="text-sm">Address</Label>
            <Switch checked={block.showAddress} onCheckedChange={(v) => onChange({ showAddress: v } as never)} />
          </div>
          <div className="flex items-center justify-between rounded-sm border border-border p-3">
            <Label className="text-sm">Unsubscribe</Label>
            <Switch checked={block.showUnsubscribe} onCheckedChange={(v) => onChange({ showUnsubscribe: v } as never)} />
          </div>
          <div className="space-y-1.5">
            <Label>Custom text</Label>
            <Textarea rows={2} value={block.customText || ""} onChange={(e) => onChange({ customText: e.target.value } as never)} />
          </div>
        </div>
      );
  }
}

function AlignSelect({ value, onChange }: { value: string; onChange: (v: "left" | "center" | "right") => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Alignment</Label>
      <Select value={value} onValueChange={(v) => onChange(v as never)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="center">Center</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}