import { LandingShell } from "@/components/landing/LandingShell";
import { Hero, Section, SectionHeader, FeatureGrid, Steps, CTABanner } from "@/components/landing/sections";
import { Crown, ConciergeBell, BarChart3, ShieldCheck, KeySquare, Banknote, Wrench, Phone } from "lucide-react";
import heroImg from "@/assets/landing-managed-hero.jpg";

const FEATURES = [
  { icon: <KeySquare className="h-4 w-4" strokeWidth={1.5} />, title: "Leasing & marketing", body: "Listings on Bayut, Property Finder & Dubizzle. Photography, viewings, screening, lease drafting, Ejari. We close vacancies fast." },
  { icon: <Wrench className="h-4 w-4" strokeWidth={1.5} />, title: "Maintenance, handled", body: "24/7 tenant hotline. Vetted vendors. Quotes within hours. Approvals routed to you. Photo proof on completion." },
  { icon: <Banknote className="h-4 w-4" strokeWidth={1.5} />, title: "Rent collection & accounting", body: "Direct bank transfers, monthly reconciliation, VAT-ready ledgers, owner statements on the 1st of every month." },
  { icon: <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />, title: "Compliance & legal", body: "Ejari renewals, RDC representation, eviction notices, insurance — managed by our in-house legal partners." },
  { icon: <BarChart3 className="h-4 w-4" strokeWidth={1.5} />, title: "Owner reporting", body: "A live dashboard plus a beautifully designed monthly statement. Know your yield, your cash position, and what's next." },
  { icon: <ConciergeBell className="h-4 w-4" strokeWidth={1.5} />, title: "Concierge for your tenants", body: "Move-in walkthroughs, key handover, deep cleans, even short-term stays for visiting owners. We are the front desk." },
];

const STEPS = [
  { title: "30-min discovery", body: "We learn your portfolio, your goals, and what you need from a manager. No pitch — just listening." },
  { title: "Proposal & onboarding", body: "Fixed-fee proposal in 48 hours. If it's a fit, we onboard your units, transfer leases, and brief tenants." },
  { title: "We take over", body: "Day 1 we're the registered manager. Tenants call us. Vendors invoice us. You receive a clean monthly statement." },
  { title: "You stay informed", body: "A live owner dashboard, monthly review calls, and quarterly portfolio strategy sessions." },
];

const STATS = [
  { kpi: "98%", label: "Rent collected on time" },
  { kpi: "<6h", label: "Average maintenance response" },
  { kpi: "21 days", label: "Average vacancy filled" },
  { kpi: "1st", label: "Owner statement, every month" },
];

export default function ForPropertyManagers() {
  return (
    <LandingShell>
      <Hero
        eyebrow="Fully Managed by Post Build"
        headline={<>Forget you own it. <span className="text-accent">Just collect the rent.</span></>}
        punchline={<>White-glove property management. One flat fee.</>}
        sub="Tired of late-night tenant calls, unpaid rent, and chasing handymen across timezones? We become your property management company — leasing, maintenance, finance, compliance — so your portfolio runs itself."
        servicesHook="Every service your property needs — leasing, repairs, legal, cleaning — already in our concierge stack."
        primaryCta={{ label: "Talk to our team", href: "mailto:concierge@postbuild.com?subject=Fully%20Managed%20enquiry&body=Hi%20Post%20Build%20team%2C%0A%0AI'd%20like%20to%20discuss%20fully%20managed%20property%20management.%0A%0AProperties%3A%0ALocation%3A%0ABest%20time%20to%20call%3A" }}
        secondaryCta={{ label: "Book a discovery call", href: "https://cal.com/postbuild/managed-discovery" }}
        image={heroImg}
        imageAlt="Floating concierge dashboard with orbital service icons"
      />

      {/* Trust strip */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center md:text-left">
              <div className="font-display text-3xl sm:text-4xl text-architect">{s.kpi}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What we manage */}
      <Section>
        <SectionHeader
          eyebrow="What we take off your plate"
          title={<>Everything a property needs. <span className="text-accent">Done by us.</span></>}
          intro="Most owners don't want a property management dashboard — they want a property management company that actually does the work. That's us."
        />
        <div className="mt-12">
          <FeatureGrid features={FEATURES} columns={3} />
        </div>
      </Section>

      {/* Pricing/positioning */}
      <Section tone="muted">
        <div className="grid gap-12 lg:grid-cols-2 items-start">
          <SectionHeader
            eyebrow="Pricing"
            title={<>One simple fee. <span className="text-accent">No hidden margins.</span></>}
            intro="A flat percentage of collected rent — typically 5–8% depending on your portfolio. Vendor invoices passed through at cost. Vacancy fees only when we successfully lease."
          />
          <div className="rounded-sm border border-border bg-card p-8 sm:p-10">
            <div className="text-[10px] uppercase tracking-[0.22em] text-accent">Included in your fee</div>
            <ul className="mt-5 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm text-architect">
              {[
                "Tenant communication & 24/7 hotline",
                "Maintenance coordination",
                "Rent collection & reconciliation",
                "Monthly owner statements",
                "Lease renewals & rent reviews",
                "Ejari & municipal compliance",
                "Quarterly strategy review",
                "Live owner dashboard",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="h-1 w-1 rounded-full bg-accent mt-2 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="How it works" title="From first call to fully managed in two weeks." />
        <div className="mt-12">
          <Steps steps={STEPS} />
        </div>
      </Section>

      {/* Testimonial */}
      <section className="mx-auto max-w-4xl px-5 sm:px-8 py-16 sm:py-24 text-center">
        <Crown className="h-5 w-5 text-accent mx-auto" strokeWidth={1.5} />
        <blockquote className="font-display text-2xl sm:text-4xl leading-snug text-architect mt-6">
          "I haven't thought about my apartment in nine months. I get the rent, I get the report, the place is full. That's exactly what I wanted."
        </blockquote>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-6">
          M. Rahman · Owner · Marina, Dubai
        </div>
      </section>

      <CTABanner
        eyebrow="White-glove property management"
        title="Let's talk about your portfolio."
        sub="A 30-minute discovery call. We listen, you decide. No pitch deck, no pressure."
        primaryCta={{ label: "Book a discovery call", href: "https://cal.com/postbuild/managed-discovery" }}
        secondaryCta={{ label: "Email our concierge", href: "mailto:concierge@postbuild.com" }}
      />

      {/* Floating phone CTA on mobile */}
      <a
        href="tel:+971000000000"
        className="fixed bottom-5 right-5 sm:hidden bg-architect text-chalk rounded-full p-4 shadow-2xl"
        aria-label="Call us"
      >
        <Phone className="h-4 w-4" />
      </a>
    </LandingShell>
  );
}