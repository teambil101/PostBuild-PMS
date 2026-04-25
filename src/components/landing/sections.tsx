import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

export function Hero({
  eyebrow,
  headline,
  sub,
  primaryCta,
  secondaryCta,
  image,
  imageAlt,
}: {
  eyebrow: string;
  headline: ReactNode;
  sub: string;
  primaryCta: { label: string; to?: string; href?: string };
  secondaryCta?: { label: string; to?: string; href?: string };
  image: string;
  imageAlt: string;
}) {
  return (
    <section className="relative overflow-hidden">
      {/* background ornament */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[640px] h-[640px] rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute top-1/3 -left-32 w-[480px] h-[480px] rounded-full bg-warm-stone/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28 grid gap-12 lg:grid-cols-[1.05fr_1fr] items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
            <span className="h-px w-6 bg-accent" />
            {eyebrow}
          </div>
          <h1 className="font-display text-[2.6rem] sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-architect">
            {headline}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">{sub}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <CTAButton variant="primary" cta={primaryCta} />
            {secondaryCta && <CTAButton variant="ghost" cta={secondaryCta} />}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 bg-gradient-to-br from-accent/15 via-transparent to-warm-stone/30 rounded-sm blur-2xl" aria-hidden />
          <img
            src={image}
            alt={imageAlt}
            width={1536}
            height={1152}
            className="relative w-full h-auto rounded-sm shadow-2xl ring-1 ring-border"
          />
        </div>
      </div>
    </section>
  );
}

function CTAButton({ variant, cta }: { variant: "primary" | "ghost"; cta: { label: string; to?: string; href?: string } }) {
  const className = "rounded-sm h-11 px-5 text-sm uppercase tracking-[0.12em]";
  const inner = (
    <>
      {cta.label}
      <ArrowRight className="ml-2 h-3.5 w-3.5" />
    </>
  );
  if (cta.to) {
    return (
      <Button asChild variant={variant === "primary" ? "default" : "ghost"} size="lg" className={className}>
        <Link to={cta.to}>{inner}</Link>
      </Button>
    );
  }
  return (
    <Button asChild variant={variant === "primary" ? "default" : "ghost"} size="lg" className={className}>
      <a href={cta.href}>{inner}</a>
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section header                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHeader({
  eyebrow,
  title,
  intro,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "max-w-2xl mx-auto text-center" : "max-w-2xl"}>
      <div className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-accent mb-4 ${align === "center" ? "justify-center" : ""}`}>
        <span className="h-px w-6 bg-accent" />
        {eyebrow}
      </div>
      <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-[1.1] tracking-tight text-architect">{title}</h2>
      {intro && <p className="mt-4 text-base text-muted-foreground leading-relaxed">{intro}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pain / problem strip                                                        */
/* -------------------------------------------------------------------------- */

export function PainList({ items }: { items: { quote: string; meta?: string }[] }) {
  return (
    <ul className="grid gap-px bg-border rounded-sm overflow-hidden ring-1 ring-border">
      {items.map((p, i) => (
        <li key={i} className="bg-card p-6 sm:p-8">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Problem · {String(i + 1).padStart(2, "0")}</div>
          <p className="font-display text-xl sm:text-2xl text-architect leading-snug">"{p.quote}"</p>
          {p.meta && <p className="text-xs text-muted-foreground mt-2">{p.meta}</p>}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Feature grid                                                                */
/* -------------------------------------------------------------------------- */

export function FeatureGrid({
  features,
  columns = 3,
}: {
  features: { icon: ReactNode; title: string; body: string }[];
  columns?: 2 | 3;
}) {
  return (
    <div className={`grid gap-px bg-border rounded-sm overflow-hidden ring-1 ring-border ${columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
      {features.map((f, i) => (
        <div key={i} className="bg-card p-6 sm:p-8 flex flex-col gap-3">
          <div className="h-9 w-9 rounded-sm bg-accent/15 text-accent flex items-center justify-center">{f.icon}</div>
          <div className="font-display text-xl text-architect leading-snug mt-1">{f.title}</div>
          <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Numbered steps                                                              */
/* -------------------------------------------------------------------------- */

export function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <div className="font-display text-5xl text-accent/40 leading-none">{String(i + 1).padStart(2, "0")}</div>
          <div className="mt-3 font-display text-lg text-architect">{s.title}</div>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/*  Service catalog (chips)                                                     */
/* -------------------------------------------------------------------------- */

export function ServicesChips({ groups }: { groups: { label: string; items: string[] }[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <div key={g.label} className="rounded-sm border border-border bg-card p-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-accent mb-4">{g.label}</div>
          <ul className="space-y-2">
            {g.items.map((it) => (
              <li key={it} className="flex items-start gap-2 text-sm text-architect">
                <Check className="h-3.5 w-3.5 text-accent shrink-0 mt-1" strokeWidth={2} />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pricing / value strip                                                       */
/* -------------------------------------------------------------------------- */

export function ValueCard({
  badge,
  title,
  price,
  priceCaption,
  bullets,
  cta,
  highlighted = false,
}: {
  badge?: string;
  title: string;
  price: string;
  priceCaption: string;
  bullets: string[];
  cta: { label: string; to?: string; href?: string };
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-sm border p-7 flex flex-col ${
        highlighted ? "bg-architect text-chalk border-architect shadow-2xl" : "bg-card border-border"
      }`}
    >
      {badge && (
        <div className={`text-[10px] uppercase tracking-[0.22em] mb-4 ${highlighted ? "text-accent" : "text-muted-foreground"}`}>{badge}</div>
      )}
      <div className="font-display text-2xl">{title}</div>
      <div className="mt-5 flex items-baseline gap-2">
        <div className="font-display text-4xl">{price}</div>
        <div className={`text-xs ${highlighted ? "text-chalk/60" : "text-muted-foreground"}`}>{priceCaption}</div>
      </div>
      <ul className="mt-6 space-y-2.5 flex-1">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm">
            <Check className={`h-3.5 w-3.5 shrink-0 mt-1 ${highlighted ? "text-accent" : "text-accent"}`} strokeWidth={2} />
            <span className={highlighted ? "text-chalk/90" : "text-architect"}>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7">
        <CTAButton variant={highlighted ? "primary" : "ghost"} cta={cta} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  CTA banner                                                                   */
/* -------------------------------------------------------------------------- */

export function CTABanner({
  eyebrow,
  title,
  sub,
  primaryCta,
  secondaryCta,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  primaryCta: { label: string; to?: string; href?: string };
  secondaryCta?: { label: string; to?: string; href?: string };
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-8 py-20">
      <div className="relative overflow-hidden rounded-sm bg-architect text-chalk px-8 sm:px-14 py-14 sm:py-20">
        <div aria-hidden className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-accent/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="text-[10px] uppercase tracking-[0.22em] text-accent mb-4">{eyebrow}</div>
          <h2 className="font-display text-3xl sm:text-5xl leading-[1.05] tracking-tight">{title}</h2>
          {sub && <p className="mt-5 text-chalk/70 text-base sm:text-lg leading-relaxed max-w-2xl">{sub}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <CTAButton variant="primary" cta={primaryCta} />
            {secondaryCta && <CTAButton variant="ghost" cta={secondaryCta} />}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section wrapper                                                              */
/* -------------------------------------------------------------------------- */

export function Section({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted";
}) {
  return (
    <section className={`${tone === "muted" ? "bg-muted/40" : ""} ${className}`}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-20 sm:py-24">{children}</div>
    </section>
  );
}