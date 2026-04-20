import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";

/**
 * Lead detail page (placeholder for L1 Pass 2).
 * Full implementation lands in Pass 3 — header, summary cards, tabs (Overview /
 * Activities / Documents / History), and inline edit. For now the route exists
 * so the list page links resolve.
 */
export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  return (
    <>
      <PageHeader
        eyebrow="Lead"
        title="Lead detail"
        description="Detail view ships in the next pass."
      />
      <div className="text-sm text-muted-foreground">Lead ID: <span className="mono">{leadId}</span></div>
    </>
  );
}
