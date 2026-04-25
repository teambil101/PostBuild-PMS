import { Link, useLocation } from "react-router-dom";
import { Home, Building2, FileText, Sparkles, Users, Settings as SettingsIcon, LogOut } from "lucide-react";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { key: "home", path: "/owner", label: "Home", icon: Home },
  { key: "properties", path: "/owner/properties", label: "My Properties", icon: Building2 },
  { key: "leases", path: "/owner/leases", label: "Tenants & Leases", icon: Users },
  { key: "documents", path: "/owner/documents", label: "Documents", icon: FileText },
  { key: "services", path: "/owner/services", label: "Request Services", icon: Sparkles },
  { key: "account", path: "/owner/account", label: "Account", icon: SettingsIcon },
];

export function OwnerShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { activeWorkspace } = useWorkspace();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 pt-7 pb-8">
          <Link to="/owner" className="block">
            <div className="font-display text-2xl text-chalk leading-none">Post Build</div>
            <div className="label-eyebrow mt-1.5 text-sidebar-foreground/60">Owner Portal</div>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          <div className="label-eyebrow px-3 pb-2 text-sidebar-foreground/50">Menu</div>
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/owner"
                ? location.pathname === "/owner"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.key}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors relative",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-chalk",
                )}
              >
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-gold" />}
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-5 border-t border-sidebar-border">
          <div className="label-eyebrow text-sidebar-foreground/40 mb-1">Workspace</div>
          <div className="font-display text-base text-chalk truncate">{activeWorkspace?.name ?? "—"}</div>
          <div className="mono text-[10px] text-gold mt-0.5 uppercase">{activeWorkspace?.plan ?? ""} · owner</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 lg:h-16 border-b hairline bg-background flex items-center justify-between gap-2 px-4 lg:px-10 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link to="/owner" className="lg:hidden font-display text-lg text-architect shrink-0">Post Build</Link>
            <span className="hidden lg:flex mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Owner Portal
            </span>
          </div>
          <div className="flex items-center gap-2 lg:gap-3 shrink-0">
            <WorkspaceSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-sm border border-warm-stone/60 px-1.5 py-1 lg:px-2.5 lg:py-1.5 hover:bg-muted/50 transition-colors">
                  <div className="h-7 w-7 bg-architect text-chalk flex items-center justify-center rounded-sm text-xs font-medium shrink-0">
                    {initials(user?.email?.[0], user?.email?.[1])}
                  </div>
                  <span className="hidden md:block text-sm text-architect max-w-[140px] truncate">{user?.email}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    <p className="mono text-[10px] uppercase text-muted-foreground">Owner</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="lg:hidden border-b hairline overflow-x-auto sticky top-14 z-20 bg-background">
          <div className="flex gap-1 px-3 py-2 w-max">
            {NAV.map((item) => {
              const isActive =
                item.path === "/owner"
                  ? location.pathname === "/owner"
                  : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={cn(
                    "shrink-0 px-3 py-1.5 text-[11px] uppercase tracking-wider rounded-sm whitespace-nowrap",
                    isActive ? "bg-architect text-chalk" : "text-muted-foreground hover:text-architect",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-12 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}