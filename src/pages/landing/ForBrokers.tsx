import { LandingShell } from "@/components/landing/LandingShell";
import { Hero, Section, SectionHeader, PainList, FeatureGrid, Steps, ServicesChips, ValueCard, CTABanner } from "@/components/landing/sections";
import { Workflow, Users, Layers, MessageSquare, Sparkles, BadgeCheck } from "lucide-react";
import heroImg from "@/assets/landing-broker-hero.jpg";

const FEATURES = [
  { icon: <Workflow className="h-4 w-4" strokeWidth={1.5} />, title: "Operations, end-to-end", body: "Leads → viewings → leases → renewals → maintenance → renewals again. One pipeline, not seven WhatsApp groups." },
  { icon: <Users className="h-4 w-4" strokeWidth={1.5} />, title: "Owner & tenant portals", body: "Branded portals where your owners see statements and your tenants pay rent. Your logo, your colors, your terms." },
  { icon: <Layers className="h-4 w-4" strokeWidth={1.5} />, title: "Multi-property workspace", body: "Hundreds of units, dozens of owners, one team. Roles, permissions, and clean handoffs between agents." },
  { icon: <MessageSquare className="h-4 w-4" strokeWidth={1.5} />, title: "Email that sells you", body: "Beautifully branded emails for every event — quotes, reminders, lease renewals, work updates. Pre-built and editable." },
  { icon: <Sparkles className="h-4 w-4" strokeWidth={1.5} />, title: "Vendor marketplace", body: "Need a contractor? Tap our vetted network or use your own. Multiple quotes side-by-side, scoring built in." },
  { icon: <BadgeCheck className="h-4 w-4" strokeWidth={1.5} />, title: "Audit-grade records", body: "Every approval, every invoice, every status change. RDC-ready exports and owner-ready reports." },
];

const PAINS = [
  { quote: "We lost a 12-unit owner because we couldn't show them a clean P&L.", meta: "Boutique broker · 80 units" },
  { quote: "Half my agents' day is forwarding screenshots between owners and vendors.", meta: "PM company · 200 units" },
  { quote: "Renewals slip through the cracks. Last quarter we missed five.", meta: "Broker · 35 owners" },
  { quote: "I can't onboard a junior agent because everything lives in someone's head.", meta: "Founder, PM startup" },
];

const SERVICES = [
  { label: "For your owners", items: ["AC & maintenance", "Cleaning crews", "Snagging & inspection", "Insurance", "Painting & refit", "Furnishing"] },
  { label: "For your operation", items: ["Lead generation", "Photography & 360 tours", "Listing syndication", "Tenant screening", "Lease drafting", "Eviction & RDC"] },
  { label: "For your business", items: ["Bookkeeping & VAT", "Owner reporting templates", "Branding & email design", "Custom integrations", "Onboarding service", "24/7 tenant hotline"] },
];

const STEPS = [
  { title: "Spin up your workspace", body: "Branded with your logo and colors in five minutes. Import your owners, properties and active leases." },
  { title: "Onboard your team", body: "Invite agents with the right roles and permissions. Each one sees only what they should." },
  { title: "Plug in services", body: "Use your existing vendors or tap our marketplace. Compare quotes, route approvals, log everything." },
  { title: "Wow your owners", body: "Owners log into a beautiful branded portal. They see statements, invoices, photos. They renew faster." },
];

export default function ForBrokers() {
  return (
    <LandingShell>
      <Hero
        eyebrow="For Brokers & PM Companies"
        headline={<>Operations as your <span className="text-accent">competitive edge.</span></>}
        sub="A complete workspace for boutique brokers and property management firms. Run your day-to-day, delight your owners, and tap a vendor marketplace whenever you need an extra hand."
        primaryCta={{ label: "Talk to us", href: "mailto:sales@postbuild.com?subject=Broker%20%2F%20PM%20demo&body=Hi%20Post%20Build%20team%2C%0A%0AI'd%20like%20to%20see%20a%20demo%20of%20the%20broker%20%2F%20PM%20workspace.%0A%0ACompany%3A%0AUnits%20managed%3A%0ABest%20time%20to%20call%3A" }}
        secondaryCta={{ label: "Book a 20-min call", href: "https://cal.com/postbuild/broker-demo" }}
        image={heroImg}
        imageAlt="Glass dashboard cards showing pipeline and vendor marketplace"
      />

      <Section tone="muted">
        <SectionHeader
          eyebrow="The broker's headache"
          title={<>You didn't get into property to live in a <span className="text-accent">spreadsheet.</span></>}
          intro="Most brokers and small PM firms run on goodwill, WhatsApp and luck. Our customers tell us:"
        />
        <div className="mt-12">
          <PainList items={PAINS} />
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="The workspace"
          title={<>Everything your team needs. <span className="text-accent">Nothing it doesn't.</span></>}
          intro="Built with brokers and small PM firms — not enterprise property companies. Lean, fast, opinionated."
        />
        <div className="mt-12">
          <FeatureGrid features={FEATURES} columns={3} />
        </div>
      </Section>

      <Section tone="muted">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] items-start">
          <SectionHeader
            eyebrow="Service marketplace"
            title={<>Extend your team — <span className="text-accent">on demand.</span></>}
            intro="Use your own preferred vendors, ours, or both. Multiple quotes side by side. Approval flows that respect who's paying."
          />
          <ServicesChips groups={SERVICES} />
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="How it works" title="From contract to calm in four steps." />
        <div className="mt-12">
          <Steps steps={STEPS} />
        </div>
      </Section>

      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-20 sm:py-24">
        <SectionHeader
          eyebrow="Pricing"
          title={<>Per-unit, transparent, <span className="text-accent">no contract.</span></>}
          align="center"
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          <ValueCard
            badge="Starter"
            title="Boutique"
            price="AED 19"
            priceCaption="per unit / month · up to 50 units"
            bullets={[
              "Full broker workspace",
              "Branded owner & tenant portals",
              "5 team seats",
              "Email templates & branding",
              "Marketplace access",
              "Email support",
            ]}
            cta={{ label: "Talk to sales", href: "mailto:sales@postbuild.com?subject=Boutique%20plan" }}
          />
          <ValueCard
            badge="Most popular"
            title="Professional"
            price="AED 12"
            priceCaption="per unit / month · 50+ units"
            bullets={[
              "Everything in Boutique",
              "Unlimited team seats",
              "Custom domains",
              "API & integrations",
              "Onboarding service included",
              "Dedicated account manager",
            ]}
            cta={{ label: "Book a demo", href: "https://cal.com/postbuild/broker-demo" }}
            highlighted
          />
        </div>
      </section>

      <CTABanner
        eyebrow="Operations as a moat"
        title="See it run on your own portfolio."
        sub="A 20-minute call. We import a sample of your data, you tell us what's broken, we show you what fixed looks like."
        primaryCta={{ label: "Book a demo", href: "https://cal.com/postbuild/broker-demo" }}
        secondaryCta={{ label: "Email sales", href: "mailto:sales@postbuild.com?subject=Broker%20demo" }}
      />
    </LandingShell>
  );
}