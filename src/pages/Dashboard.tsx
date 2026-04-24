import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { StaffVendorsTab } from "@/components/dashboard/StaffVendorsTab";

const STORAGE_KEY = "dashboardTab";
const VALID = ["staff_vendors", "properties", "directory", "vendors"] as const;
type DashTab = (typeof VALID)[number];

function loadTab(): DashTab {
  if (typeof window === "undefined") return "staff_vendors";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (VALID as readonly string[]).includes(raw)) return raw as DashTab;
  } catch {
    /* ignore */
  }
  return "staff_vendors";
}

function ComingSoonPanel({ label }: { label: string }) {
  return (
    <div className="border hairline rounded-sm bg-muted/20 p-12 text-center">
      <div className="font-display text-xl text-architect mb-2">{label} dashboard</div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Coming soon. We'll add KPIs and insights specific to {label.toLowerCase()} once the
        Staff &amp; Vendors view is settled.
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<DashTab>(() => loadTab());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={`Welcome${user?.email ? `, ${user.email.split("@")[0]}` : ""}`}
        description="Operational view of who is doing the work, how well, and at what cost."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as DashTab)}>
        <TabsList className="flex w-full overflow-x-auto h-auto p-1 justify-start">
          <TabsTrigger value="staff_vendors">Staff &amp; Vendors</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
        </TabsList>

        <TabsContent value="staff_vendors" className="mt-6">
          <StaffVendorsTab />
        </TabsContent>
        <TabsContent value="properties" className="mt-6">
          <ComingSoonPanel label="Properties" />
        </TabsContent>
        <TabsContent value="directory" className="mt-6">
          <ComingSoonPanel label="Directory" />
        </TabsContent>
        <TabsContent value="vendors" className="mt-6">
          <ComingSoonPanel label="Vendors" />
        </TabsContent>
      </Tabs>
    </>
  );
}
