import { Navigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * Blocks broker workspaces from accessing operator-only routes
 * (catalog management, marketplace inbox, etc.). Redirects to /services.
 */
export function RequireNotBroker({ children }: { children: React.ReactNode }) {
  const { isBroker, loading } = useWorkspace();
  const toasted = useRef(false);

  useEffect(() => {
    if (!loading && isBroker && !toasted.current) {
      toasted.current = true;
      toast.error("Brokers can request services but not manage the catalog.");
    }
  }, [loading, isBroker]);

  if (loading) return null;
  if (isBroker) return <Navigate to="/services" replace />;
  return <>{children}</>;
}