import { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  // AUTH TEMPORARILY DISABLED — re-enable by restoring the useAuth gate below.
  return <>{children}</>;
}
