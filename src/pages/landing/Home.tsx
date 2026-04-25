import { Link } from "react-router-dom";
import { LandingShell } from "@/components/landing/LandingShell";
import { ArrowRight, Building2, Briefcase, Crown } from "lucide-react";
import ownerHero from "@/assets/landing-owner-hero.jpg";
import brokerHero from "@/assets/landing-broker-hero.jpg";
import managedHero from "@/assets/landing-managed-hero.jpg";

const PERSONAS = [
  {
    to: "/for-owners",
    eyebrow: "For Property Owners",
    title: "Run your portfolio from anywhere.",
    sub: "Free tools for retail investors and small landlords managing 1–30 units. Book any service in one click.",
    image: ownerHero,
    icon: Building2,
    cta: "See owner tools",
  },
  {
    to: "/for-brokers",
    eyebrow: "For Brokers & PM Companies",
    title: "Operations as your competitive edge.",
    sub: "A complete workspace for brokers and small PM teams — leases, vendors, marketplace, and a private branded portal.",
    image: brokerHero,
    icon: Briefcase,
    cta: "Run your operation",
  },
  {
    to: "/for-property-managers",
    eyebrow: "Fully Managed by Post Build",
    title: "Hands off. Done right.",
    sub: "We become your property management company — leasing, maintenance, finances, reporting. You just receive the rent.",
    image: managedHero,
    icon: Crown,
    cta: "Talk to our team",
  },
];

export default function LandingHome() {
  return (
    <LandingShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 right-1/4 w-[680px] h-[680px] rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-[520px] h-[520px] rounded-full bg-warm-stone/30 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-20 pb-12 lg:pt-28 lg:pb-16 text-center">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
            <span className="h-px w-6 bg-accent" />
            Property Operations · Reimagined
          </div>
          <h1 className="font-display text-[2.6rem] sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-architect max-w-4xl mx-auto">
            One platform for everyone who touches a property.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Whether you own a single apartment, broker a hundred, or want it all done for you — Post Build is the operating system for your real estate.
          </p>
        </div>
      </section>

      {/* Persona cards */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 pb-24">
        <div className="grid gap-6 lg:grid-cols-3">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.to}
                to={p.to}
                className="group relative rounded-sm bg-card border border-border overflow-hidden hover:border-accent transition-colors flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={p.image}
                    alt={p.title}
                    width={1536}
                    height={1152}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="p-7 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-accent">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {p.eyebrow}
                  </div>
                  <div className="font-display text-2xl text-architect mt-4 leading-snug">{p.title}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-3 flex-1">{p.sub}</p>
                  <div className="mt-6 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-architect group-hover:text-accent transition-colors">
                    {p.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </LandingShell>
  );
}