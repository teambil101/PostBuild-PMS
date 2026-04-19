import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { EmptyState } from "@/components/EmptyState";

export default function ComingSoon() {
  const navigate = useNavigate();
  const location = useLocation();
  const mod = MODULES.find((m) => location.pathname.startsWith(m.path));

  return (
    <>
      <PageHeader
        eyebrow="Module"
        title={mod?.label ?? "Coming Soon"}
        description="This module is part of the True Build roadmap. We'll build it in a focused pass once Properties and People feel rock solid."
        actions={
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Button>
        }
      />
      <EmptyState
        icon={<Construction className="h-10 w-10" strokeWidth={1.2} />}
        title="On the roadmap"
        description="One module at a time. We'll activate this once the foundation is polished and the design patterns are proven on Properties + People."
      />
    </>
  );
}
