import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { CompanyProfileForm } from "@/components/settings/CompanyProfileForm";
import { Building2, CreditCard, Bell, Plug, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  key: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
}

const SECTIONS: Section[] = [
  { key: "company", label: "Company Profile", icon: Building2, enabled: true },
  { key: "billing", label: "Billing", icon: CreditCard, enabled: false },
  { key: "notifications", label: "Notifications", icon: Bell, enabled: false },
  { key: "integrations", label: "Integrations", icon: Plug, enabled: false },
];

export default function Settings() {
  const [active, setActive] = useState("company");

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Configure your workspace, company profile, and integrations."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Left rail */}
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                disabled={!s.enabled}
                onClick={() => s.enabled && setActive(s.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-colors text-left",
                  isActive
                    ? "bg-architect text-chalk"
                    : s.enabled
                      ? "text-architect hover:bg-muted/60"
                      : "text-muted-foreground/40 cursor-not-allowed",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="flex-1">{s.label}</span>
                {!s.enabled && (
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right pane */}
        <div className="min-w-0 max-w-3xl">
          {active === "company" && <CompanyProfileForm />}
        </div>
      </div>
    </>
  );
}