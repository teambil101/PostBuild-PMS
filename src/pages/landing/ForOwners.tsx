import { LandingShell } from "@/components/landing/LandingShell";
import { Hero, Section, SectionHeader, PainList, FeatureGrid, Steps, ServicesChips, ValueCard, CTABanner } from "@/components/landing/sections";
import { Globe2, Wallet, FileSignature, Wrench, Bell, ShieldCheck } from "lucide-react";
import heroImg from "@/assets/landing-owner-hero.jpg";

const FEATURES = [
  { icon: <Globe2 className="h-4 w-4" strokeWidth={1.5} />, title: "Manage from any timezone", body: "A clean web app that works from Dubai, London, or Karachi. See every unit, lease, and rent payment at a glance — no spreadsheets." },
  { icon: <Wallet className="h-4 w-4" strokeWidth={1.5} />, title: "Rent, invoices & receipts", body: "Auto-generated invoices, payment reminders, and a clean owner ledger. Know what's been paid and what's overdue without chasing." },
  { icon: <FileSignature className="h-4 w-4" strokeWidth={1.5} />, title: "Lease & document vault", body: "Every contract, Ejari, and inspection report in one searchable place. Branded templates included." },
  { icon: <Wrench className="h-4 w-4" strokeWidth={1.5} />, title: "Maintenance, on tap", body: "Tenant reports an issue → we route it to vetted vendors → you approve the cost. No phone calls, no follow-ups." },
  { icon: <Bell className="h-4 w-4" strokeWidth={1.5} />, title: "Smart alerts", body: "Lease expiring in 90 days. Rent overdue. Insurance lapsed. The right nudge at the right time, by email." },
  { icon: <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />, title: "You stay in control", body: "Every charge requires your approval. Every vendor is rated. Every transaction has a paper trail." },
];

const PAINS = [
  { quote: "I haven't seen the apartment in 18 months. I have no idea what condition it's in.", meta: "Owner · 2 units · Lives abroad" },
  { quote: "My broker takes 5% but I still have to find the AC guy myself.", meta: "Owner · 4 units" },
  { quote: "The tenant moved out and left me with AED 12,000 in unpaid bills. I found out three weeks later.", meta: "Owner · 1 unit · Long-distance" },
  { quote: "Three different WhatsApp groups, no record of anything. When I sell I'll have nothing to show a buyer.", meta: "Owner · 6 units" },
];

const SERVICES = [
  { label: "Maintenance", items: ["AC servicing & repair", "Plumbing", "Electrical", "Pest control", "Deep cleaning", "Handyman"] },
  { label: "Property care", items: ["Move-in / move-out inspection", "Annual condition report", "Snagging", "Painting & touch-ups", "Locks & keys", "Insurance"] },
  { label: "Legal & admin", items: ["Lease drafting", "Ejari / municipal filing", "Eviction notices", "RDC representation", "Power of attorney", "Tax & VAT support"] },
];

const STEPS = [
  { title: "Sign up free", body: "Create your workspace in 60 seconds. Add your properties, units and tenants — or import a list." },
  { title: "Invite the players", body: "Tenants get a portal to pay rent and report issues. Vendors get quote requests. You stay in the middle." },
  { title: "Order any service", body: "Browse our vetted marketplace, request quotes, approve in one click. We handle the back-and-forth." },
  { title: "Get monthly clarity", body: "Owner statement, rent collected, services delivered, what needs attention — landed in your inbox." },
];

export default function ForOwners() {
  return (
    <LandingShell>
      <Hero
        eyebrow="For Property Owners"
        headline={<>Manage Your <span className="text-accent">Properties</span> Easily</>}
        punchline="Stop the WhatsApp chaos. Start managing."
        sub="Free management tools for owners with 1–30 units. When something needs doing, request any service in one click — vetted vendors, transparent quotes, your approval. Designed for owners who don't live next door."
        servicesHook="Vetted services marketplace included"
        primaryCta={{ label: "Sign up free", to: "/auth?signup=1&persona=owner" }}
        secondaryCta={{ label: "See how it works", href: "#how" }}
        image={heroImg}
        imageAlt="Glass dashboard card showing a building portfolio overview"
      />

      {/* Pain section */}
      <Section tone="muted">
        <SectionHeader
          eyebrow="The owner's reality"
          title={<>If any of this sounds familiar, <span className="text-accent">we built this for you.</span></>}
          intro="Most owners aren't in the property business — they're nurses, founders, expats, retirees. The tools they're given are built for property companies, not for them."
        />
        <div className="mt-12">
          <PainList items={PAINS} />
        </div>
      </Section>

      {/* Features */}
      <Section>
        <SectionHeader
          eyebrow="What you get — for free"
          title={<>The tools a property company would charge you 5% for.</>}
          intro="Management software is free, forever. We make money only when you choose to use one of our services — and only after you approve the quote."
        />
        <div className="mt-12">
          <FeatureGrid features={FEATURES} columns={3} />
        </div>
      </Section>

      {/* Services marketplace */}
      <Section tone="muted" className="scroll-mt-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] items-start">
          <SectionHeader
            eyebrow="Services on tap"
            title={<>Anything your property needs. <span className="text-accent">One click away.</span></>}
            intro="Vetted vendors. Multiple quotes. Your approval before a dirham is spent. We never mark up vendor pricing."
          />
          <ServicesChips groups={SERVICES} />
        </div>
      </Section>

      {/* How it works */}
      <Section>
        <SectionHeader
          eyebrow="How it works"
          title="Four steps to a calmer portfolio."
        />
        <div className="mt-12">
          <Steps steps={STEPS} />
        </div>
      </Section>

      {/* Pricing */}
      <section id="how" className="mx-auto max-w-7xl px-5 sm:px-8 py-20 sm:py-24">
        <SectionHeader
          eyebrow="Honest pricing"
          title={<>Free management. <span className="text-accent">Pay only for services.</span></>}
          align="center"
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          <ValueCard
            badge="Always Free"
            title="Owner Workspace"
            price="AED 0"
            priceCaption="forever, up to 30 units"
            bullets={[
              "All management tools",
              "Tenant & vendor portals",
              "Branded lease templates",
              "Owner statements & reports",
              "Email & document vault",
              "Smart alerts",
            ]}
            cta={{ label: "Sign up free", to: "/auth?signup=1&persona=owner" }}
          />
          <ValueCard
            badge="Pay-as-you-go"
            title="Marketplace Services"
            price="From AED 50"
            priceCaption="per service · vendor pricing, no markup"
            bullets={[
              "Vetted vendors only",
              "Multiple quotes per request",
              "Your approval required",
              "Direct billing to tenant or you",
              "Service guarantee",
              "Live status updates",
            ]}
            cta={{ label: "Browse services", to: "/auth?signup=1&persona=owner" }}
            highlighted
          />
        </div>
      </section>

      <CTABanner
        eyebrow="Free forever"
        title="Get your portfolio in order — in under five minutes."
        sub="No credit card. No commitment. Just better tools for the property you already own."
        primaryCta={{ label: "Sign up free", to: "/auth?signup=1&persona=owner" }}
        secondaryCta={{ label: "Email us first", href: "mailto:hello@postbuild.com?subject=Owner%20enquiry" }}
      />
    </LandingShell>
  );
}