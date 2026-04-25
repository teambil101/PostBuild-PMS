import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";

const NAV = [
  { to: "/for-owners", label: "For Owners" },
  { to: "/for-brokers", label: "For Brokers" },
  { to: "/for-property-managers", label: "Fully Managed" },
];

export function LandingShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-baseline gap-2 group">
            <span className="font-display text-xl tracking-tight text-architect group-hover:text-accent transition-colors">Post Build</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Property Operations</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors ${
                    active ? "text-architect" : "text-muted-foreground hover:text-architect"
                  }`}
                >
                  {n.label}
                  {active && <span className="block h-px bg-accent mt-1" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:inline-block text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-architect px-3 py-1.5 transition-colors">
              Sign in
            </Link>
            <Button asChild size="sm" className="rounded-sm">
              <Link to="/auth?signup=1&persona=owner">Get started</Link>
            </Button>
            <button
              onClick={() => setOpen((o) => !o)}
              className="md:hidden p-2 -mr-2 text-architect"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="mx-auto max-w-7xl px-5 py-3 flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={`text-sm py-2 ${pathname === n.to ? "text-architect" : "text-muted-foreground"}`}
                >
                  {n.label}
                </Link>
              ))}
              <Link to="/auth" onClick={() => setOpen(false)} className="text-sm py-2 text-muted-foreground">Sign in</Link>
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-architect text-chalk mt-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12 grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <div className="font-display text-2xl">Post Build</div>
            <p className="text-sm text-chalk/60 mt-3 max-w-sm leading-relaxed">
              Property operations and on-demand services, designed for owners and managers who care about the details.
            </p>
          </div>
          <FooterCol title="Personas" links={[
            { label: "For Owners", to: "/for-owners" },
            { label: "For Brokers", to: "/for-brokers" },
            { label: "Fully Managed", to: "/for-property-managers" },
          ]} />
          <FooterCol title="Product" links={[
            { label: "Sign in", to: "/auth" },
            { label: "Get started", to: "/auth?signup=1&persona=owner" },
          ]} />
          <FooterCol title="Contact" links={[
            { label: "hello@postbuild.com", href: "mailto:hello@postbuild.com" },
            { label: "sales@postbuild.com", href: "mailto:sales@postbuild.com" },
          ]} />
        </div>
        <div className="border-t border-chalk/10">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 py-5 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-chalk/50">
            <span>© {new Date().getFullYear()} Post Build</span>
            <span>Built for the long term.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to?: string; href?: string }[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-accent">{title}</div>
      <ul className="mt-4 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to} className="text-sm text-chalk/80 hover:text-chalk transition-colors">{l.label}</Link>
            ) : (
              <a href={l.href} className="text-sm text-chalk/80 hover:text-chalk transition-colors">{l.label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}