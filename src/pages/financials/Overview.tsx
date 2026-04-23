import { EmptyState } from "@/components/EmptyState";
import { LayoutDashboard } from "lucide-react";

export function Overview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Cash on hand", value: "—" },
          { label: "AR outstanding", value: "—" },
          { label: "AP outstanding", value: "—" },
          { label: "Owner payable", value: "—" },
        ].map((card) => (
          <div key={card.label} className="border hairline rounded-sm bg-card p-5">
            <div className="label-eyebrow text-muted-foreground mb-2">{card.label}</div>
            <div className="font-display text-2xl text-architect tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      <EmptyState
        icon={LayoutDashboard}
        title="Financial dashboard"
        description="Live numbers will appear once you record your first invoice or payment. Phase 2 of the financials module brings receivables online."
      />
    </div>
  );
}