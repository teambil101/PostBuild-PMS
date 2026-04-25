import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { StaffVendorsTab } from "@/components/dashboard/StaffVendorsTab";

export default function Dashboard() {
  const { user } = useAuth();

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

      <div className="mt-6">
        <StaffVendorsTab />
      </div>
    </>
  );
}
