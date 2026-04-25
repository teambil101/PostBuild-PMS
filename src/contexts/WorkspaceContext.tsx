import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type WorkspaceKind = "internal" | "owner" | "broker";
export type WorkspacePlan = "free" | "portfolio" | "broker_pro" | "enterprise";
export type WorkspaceMemberRole = "owner" | "admin" | "manager" | "agent" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  kind: WorkspaceKind;
  plan: WorkspacePlan;
  brand_color: string | null;
  logo_url: string | null;
  is_active: boolean;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isBroker: boolean;
  isOwner: boolean;
  isInternal: boolean;
  loading: boolean;
  setActive: (workspaceId: string) => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = "tb.workspace.activeId.v1";

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });
  const [loading, setLoading] = useState(true);

  const loadWorkspaces = async () => {
    setLoading(true);

    // Auth is currently bypassed in this app — fall back to all workspaces
    // the anon key can read (the bootstrap workspace, mainly). Once auth
    // is re-enabled, this will naturally scope to the user's memberships
    // via RLS on workspace_members.
    let rows: Workspace[] = [];

    if (user) {
      const { data } = await supabase
        .from("workspaces")
        .select("id, name, slug, kind, plan, brand_color, logo_url, is_active")
        .eq("is_active", true)
        .order("name");
      rows = (data ?? []) as Workspace[];
    } else {
      // No authenticated user — load any workspaces visible (read-public view of bootstrap).
      // This keeps the operator dev environment working while auth is bypassed.
      const { data } = await supabase
        .from("workspaces")
        .select("id, name, slug, kind, plan, brand_color, logo_url, is_active")
        .eq("is_active", true)
        .order("name");
      rows = (data ?? []) as Workspace[];
    }

    setWorkspaces(rows);

    // Decide active workspace
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const valid = rows.find((w) => w.id === stored) ?? rows[0] ?? null;
    if (valid) {
      setActiveId(valid.id);
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, valid.id);
    } else {
      setActiveId(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    void loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const setActive = (workspaceId: string) => {
    if (!workspaces.find((w) => w.id === workspaceId)) return;
    setActiveId(workspaceId);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, workspaceId);
  };

  const value = useMemo<WorkspaceContextValue>(
    () => {
      const active = workspaces.find((w) => w.id === activeId) ?? null;
      return {
        workspaces,
        activeWorkspace: active,
        isBroker: active?.kind === "broker",
        isOwner: active?.kind === "owner",
        isInternal: active?.kind === "internal",
        loading,
        setActive,
        refresh: loadWorkspaces,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaces, activeId, loading],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

/** Convenience helper: stable id of the currently-active workspace, or null. */
export function useActiveWorkspaceId(): string | null {
  return useWorkspace().activeWorkspace?.id ?? null;
}