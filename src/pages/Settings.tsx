import { PageHeader } from "@/components/PageHeader";
import { CompanyProfileForm } from "@/components/settings/CompanyProfileForm";

export default function Settings() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Configure the data that appears on every contract you generate."
      />
      <div className="space-y-8 max-w-3xl">
        <CompanyProfileForm />
      </div>
    </>
  );
}