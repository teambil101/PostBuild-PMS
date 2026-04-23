import { Link } from "react-router-dom";
import { ArrowRight, Building2, Users, Truck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const cards = [
    { to: "/properties", icon: Building2, label: "Properties", desc: "Buildings, units, ownership." },
    { to: "/people", icon: Users, label: "Directory", desc: "Landlords, tenants, vendors, staff." },
    { to: "/vendors", icon: Truck, label: "Vendors", desc: "Service providers and contractors." },
  ];

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={`Welcome${user?.email ? `, ${user.email.split("@")[0]}` : ""}`}
        description="A clean slate. The work and contracts modules will return once the directory and properties feel right."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group border hairline rounded-sm bg-card p-6 hover:bg-muted/30 transition-colors"
            >
              <Icon className="h-6 w-6 text-true-taupe mb-4" strokeWidth={1.4} />
              <div className="font-display text-xl text-architect mb-1">{c.label}</div>
              <div className="text-sm text-muted-foreground mb-3">{c.desc}</div>
              <div className="flex items-center gap-1 text-xs text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                Open <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
