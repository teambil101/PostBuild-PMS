import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function Services() {
  return (
    <>
      <PageHeader
        eyebrow="Module"
        title="Services"
        description="Service requests and the catalog of recurring services. One ticket per job, vendor or staff, free or paid."
      />
      <EmptyState
        icon={<Wrench className="h-10 w-10" strokeWidth={1.2} />}
        title="Coming next"
        description="The service catalog and request queue land in the next pass. Contracts are the foundation that governs them — start by drafting your first management agreement."
      />
    </>
  );
}