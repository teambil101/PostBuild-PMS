import { Link, useLocation } from "react-router-dom";
import { LogOut, Search } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const { user, signOut, roles } = useAuth();

  const currentModule = MODULES.find((m) => {
    if (location.pathname.startsWith(m.path)) return true;
    // /leads/* (legacy) belongs to People now
    if (m.key === "people" && location.pathname.startsWith("/leads")) return true;
    return false;
  });
  const role = roles[0] ?? "viewer";

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar — Architect Black */}
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 pt-7 pb-8">
          <Link to="/" className="block">
            <div className="font-display text-2xl text-chalk leading-none">True Build</div>
            <div className="label-eyebrow mt-1.5 text-sidebar-foreground/60">Property Operations</div>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          <div className="label-eyebrow px-3 pb-2 text-sidebar-foreground/50">Modules</div>
          {MODULES.map((m) => {
            const isActive =
              location.pathname.startsWith(m.path) ||
              (m.key === "people" && location.pathname.startsWith("/leads"));
            const Icon = m.icon;
            return (
              <Link
                key={m.key}
                to={m.active ? m.path : "#"}
                onClick={(e) => !m.active && e.preventDefault()}
                className={cn(
                  "group relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors",
                  m.active
                    ? "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/35 cursor-not-allowed",
                  isActive && "bg-sidebar-accent text-chalk",
                )}
              >
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-gold" />}
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="flex-1">{m.label}</span>
                {!m.active && (
                  <span className="text-[9px] uppercase tracking-wider text-sidebar-foreground/40">Soon</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-5 border-t border-sidebar-border">
          <div className="label-eyebrow text-sidebar-foreground/40 mb-1">Workspace</div>
          <div className="font-display text-base text-chalk">True Build HQ</div>
          <div className="mono text-[10px] text-gold mt-0.5 uppercase">{role}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b hairline bg-background flex items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="lg:hidden font-display text-xl text-architect">True Build</Link>
            <div className="hidden lg:flex items-center gap-2 mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <Link to="/" className="hover:text-architect">Home</Link>
              {currentModule && (
                <>
                  <span>/</span>
                  <span className="text-architect">{currentModule.label}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search…"
                className="h-9 w-64 pl-9 bg-muted/40 border-warm-stone/60 text-sm placeholder:text-muted-foreground/70 focus-visible:bg-background"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-sm border border-warm-stone/60 px-2.5 py-1.5 hover:bg-muted/50 transition-colors">
                  <div className="h-7 w-7 bg-architect text-chalk flex items-center justify-center rounded-sm text-xs font-medium">
                    {initials(user?.email?.[0], user?.email?.[1])}
                  </div>
                  <span className="hidden md:block text-sm text-architect max-w-[140px] truncate">
                    {user?.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    <p className="mono text-[10px] uppercase text-muted-foreground">{role}</p>
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

        {/* Mobile module bar */}
        <div className="lg:hidden border-b hairline overflow-x-auto">
          <div className="flex gap-1 px-4 py-2">
            {MODULES.filter((m) => m.active).map((m) => {
              const isActive = location.pathname.startsWith(m.path);
              return (
                <Link
                  key={m.key}
                  to={m.path}
                  className={cn(
                    "shrink-0 px-3 py-1.5 text-xs uppercase tracking-wider rounded-sm",
                    isActive ? "bg-architect text-chalk" : "text-muted-foreground hover:text-architect",
                  )}
                >
                  {m.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-x-hidden">
          <div
            className={cn(
              "mx-auto px-6 lg:px-10 py-8 lg:py-12 animate-fade-in",
              // Lifecycle uses a 6-column kanban that needs more breathing room
              location.pathname.startsWith("/lifecycle")
                ? "max-w-[1800px]"
                : "max-w-[1200px]",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
