import { useState } from "react";
import { useEmailTemplates, type EmailTemplateRow } from "@/hooks/useEmailTemplates";
import { TemplateEditor } from "./TemplateEditor";
import { Loader2, Mail, AlertTriangle, FileText, Bell, Wrench, CheckCircle2, FileSignature, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const CATEGORY_META: Record<string, { label: string; description: string; icon: typeof Mail }> = {
  alert: { label: "Alerts", description: "Overdue rent, lease expiry, urgent maintenance", icon: AlertTriangle },
  quote: { label: "Quotes", description: "Vendor quote invitations and acceptance", icon: FileText },
  notice: { label: "Notices", description: "Formal demand letters and legal notices", icon: FileSignature },
  service_request: { label: "Service Requests", description: "Request lifecycle communication", icon: Wrench },
  work_update: { label: "Work Updates", description: "Status changes during work", icon: Bell },
  confirmation: { label: "Confirmations", description: "Receipts, welcome, lease signed", icon: CheckCircle2 },
};

export function EmailTemplatesList() {
  const { data: templates, isLoading } = useEmailTemplates();
  const [active, setActive] = useState<EmailTemplateRow | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ alert: true });

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading templates…</div>;
  }

  if (active) {
    return <TemplateEditor template={active} onBack={() => setActive(null)} />;
  }

  const q = query.trim().toLowerCase();
  const filtered = (templates ?? []).filter((t) => {
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      t.template_key.toLowerCase().includes(q)
    );
  });

  const grouped = filtered.reduce((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {} as Record<string, EmailTemplateRow[]>);

  const order = ["alert", "quote", "notice", "service_request", "work_update", "confirmation"];
  const toggle = (cat: string) => setOpen((o) => ({ ...o, [cat]: !o[cat] }));
  const isOpen = (cat: string) => (q ? true : !!open[cat]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Email Templates</h2>
          <p className="text-xs text-muted-foreground mt-1">Tap a category to expand. Click any template to edit its copy, design, or attachments.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      <div className="rounded-sm border border-border divide-y divide-border bg-card">
        {order.map((cat) => {
          const list = grouped[cat] || [];
          if (list.length === 0 && q) return null;
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const opened = isOpen(cat);
          return (
            <div key={cat}>
              <button
                type="button"
                onClick={() => toggle(cat)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
              >
                {opened ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <Icon className="h-4 w-4 text-accent shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold uppercase tracking-wider text-architect">{meta.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{meta.description}</div>
                </div>
                <Badge variant="outline" className="text-[10px] tracking-wider shrink-0">{list.length}</Badge>
              </button>
              {opened && list.length > 0 && (
                <div className="px-3 pb-3 pt-1 grid grid-cols-1 md:grid-cols-2 gap-2 bg-muted/20">
                  {list.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setActive(t)}
                      className="text-left rounded-sm border border-border p-3 bg-card hover:border-accent hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-architect truncate">{t.name}</div>
                          {t.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</div>}
                          <div className="text-[11px] text-muted-foreground mt-1.5 truncate font-mono">{t.subject}</div>
                        </div>
                        {t.is_system && <Badge variant="outline" className="text-[9px] uppercase tracking-wider shrink-0">Default</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {Object.keys(grouped).length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No templates match "{query}".</div>
        )}
      </div>
    </div>
  );
}