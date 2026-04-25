import { useState } from "react";
import { useEmailTemplates, type EmailTemplateRow } from "@/hooks/useEmailTemplates";
import { TemplateEditor } from "./TemplateEditor";
import { Loader2, Mail, AlertTriangle, FileText, Bell, Wrench, CheckCircle2, FileSignature } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading templates…</div>;
  }

  if (active) {
    return <TemplateEditor template={active} onBack={() => setActive(null)} />;
  }

  const grouped = (templates ?? []).reduce((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {} as Record<string, EmailTemplateRow[]>);

  const order = ["alert", "quote", "notice", "service_request", "work_update", "confirmation"];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold">Email Templates</h2>
        <p className="text-xs text-muted-foreground mt-1">Customize the design, copy, and attachments for every email Post Build sends on your behalf.</p>
      </div>

      {order.map((cat) => {
        const list = grouped[cat] || [];
        if (list.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-architect">{meta.label}</h3>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {list.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActive(t)}
                  className="text-left rounded-sm border border-border p-3 hover:border-accent hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-architect truncate">{t.name}</div>
                      {t.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</div>}
                      <div className="text-xs text-muted-foreground mt-1.5 truncate font-mono">{t.subject}</div>
                    </div>
                    {t.is_system && <Badge variant="outline" className="text-[9px] uppercase tracking-wider shrink-0">Default</Badge>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}