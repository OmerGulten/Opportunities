import { ArrowRight, CircleSlash, Eye, Info, Kanban, ListChecks, Radar, SearchCheck, Send, Sparkles, Target } from "lucide-react";
import type { ComponentType } from "react";
import Link from "next/link";

import { CookieConsent } from "@/components/app/cookie-consent";
import { MarketingFooter } from "@/components/app/marketing-footer";
import { MarketingHeader } from "@/components/app/marketing-header";
import { EvidenceTypeBadge, NotExhaustiveNotice, ScoreBar, ScoreRing, ServiceBadge, WebsiteStatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthContext, getRequestLocale } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/config/env";
import { listPlans } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import type { PlanRow } from "@/types/db";

/** Reads the plans table and the session, so it must never be prerendered. */
export const dynamic = "force-dynamic";

const LOOP_STEPS: Array<{ key: string; icon: ComponentType<{ className?: string }> }> = [
  { key: "s1", icon: Radar },
  { key: "s2", icon: SearchCheck },
  { key: "s3", icon: Target },
  { key: "s4", icon: Send },
  { key: "s5", icon: Kanban },
];

const PRINCIPLES: Array<{ key: string; icon: ComponentType<{ className?: string }> }> = [
  { key: "i1", icon: ListChecks },
  { key: "i2", icon: Eye },
  { key: "i3", icon: CircleSlash },
  { key: "i4", icon: Info },
];

async function readPlans(): Promise<PlanRow[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    return await listPlans(supabase);
  } catch {
    // Reference data is not readable for this visitor; the section degrades.
    return [];
  }
}

export default async function LandingPage() {
  const locale = await getRequestLocale();
  const t = getT(locale, "marketing");
  const tc = getT(locale, "common");
  const tn = getT(locale, "nav");

  const auth = isSupabaseConfigured() ? await getAuthContext().catch(() => null) : null;
  const plans = await readPlans();

  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <MarketingHeader isAuthenticated={Boolean(auth)} />

      <main className="flex-1">
        {/* Hero */}
        <section className="surface-signal-glow border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:py-24">
            <div className="flex max-w-3xl flex-col gap-6">
              <Badge variant="outline" className="w-fit gap-1.5 border-primary/30 bg-primary/8 text-primary">
                <Sparkles className="size-3" />
                {t("hero.eyebrow")}
              </Badge>
              <h1 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-balance md:text-5xl">
                {t("hero.title")} <span className="text-gradient-brand">{t("hero.titleAccent")}</span>
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{t("hero.subtitle")}</p>
              <div className="flex flex-wrap items-center gap-3">
                {auth ? (
                  <Button size="lg" render={<Link href="/dashboard" />}>
                    {t("hero.ctaDashboard")}
                    <ArrowRight />
                  </Button>
                ) : (
                  <Button size="lg" render={<Link href="/sign-up" />}>
                    {t("hero.ctaPrimary")}
                    <ArrowRight />
                  </Button>
                )}
                <Button size="lg" variant="outline" render={<Link href="#how-it-works" />}>
                  {t("hero.ctaSecondary")}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{t("hero.note")}</p>
              <ul className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                {(["h1", "h2", "h3"] as const).map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {t(`hero.highlights.${key}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* The loop */}
        <section id="how-it-works" className="scroll-mt-16 border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance">{t("loop.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("loop.description")}</p>
            </div>
            <ol className="mt-8 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              {LOOP_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.key} className="panel flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="font-heading text-sm font-medium">{t(`loop.steps.${step.key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground">{t(`loop.steps.${step.key}.description`)}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Service-specific scoring */}
        <section id="scoring" className="scroll-mt-16 border-b bg-muted/25">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
            <div className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance">{t("scoring.title")}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{t("scoring.description")}</p>
              <ul className="space-y-2 text-sm">
                {(["b1", "b2", "b3"] as const).map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span className="text-muted-foreground">{t(`scoring.bullets.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Illustrative card assembled from the same shared components the app uses. */}
            <Card className="shadow-sm">
              <CardHeader className="gap-2">
                <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
                  {t("scoring.example.label")}
                </Badge>
                <CardTitle>{t("scoring.example.businessName")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("scoring.example.businessMeta")}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <ScoreRing score={82} size="lg" />
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">{t("scoring.example.primaryLabel")}</p>
                    <ServiceBadge name={t("scoring.example.services.website_development")} icon="globe" />
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <WebsiteStatusBadge status="not_found" />
                      <EvidenceTypeBadge evidenceType="observed" withTooltip={false} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">{t("scoring.example.secondaryLabel")}</p>
                  <ScoreBar score={64} label={t("scoring.example.services.review_management")} />
                  <ScoreBar score={48} label={t("scoring.example.services.social_media")} />
                  <ScoreBar score={31} label={t("scoring.example.services.seo")} />
                </div>

                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">{t("scoring.example.evidenceTitle")}</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {(["e1", "e2", "e3"] as const).map((key) => (
                      <li key={key} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                        {t(`scoring.example.${key}`)}
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground italic">{t("scoring.example.disclaimer")}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Honesty principles */}
        <section id="principles" className="scroll-mt-16 border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance">{t("honesty.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("honesty.description")}</p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {PRINCIPLES.map((principle) => {
                const Icon = principle.icon;
                return (
                  <div key={principle.key} className="panel flex gap-3 p-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="space-y-1">
                      <h3 className="font-heading text-sm font-medium">{t(`honesty.items.${principle.key}.title`)}</h3>
                      <p className="text-sm text-muted-foreground">{t(`honesty.items.${principle.key}.description`)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6">
              <NotExhaustiveNotice />
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="scroll-mt-16 border-b bg-muted/25">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance">{t("pricing.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("pricing.description")}</p>
            </div>

            {plans.length === 0 ? (
              <p className="mt-8 max-w-2xl rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{t("pricing.unavailable")}</p>
            ) : (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {plans.map((plan) => (
                  <Card key={plan.id} size="sm" className={plan.is_default ? "ring-2 ring-primary/40" : undefined}>
                    <CardHeader>
                      <CardTitle>{plan.name}</CardTitle>
                      <p className="font-heading text-2xl font-semibold tabular-nums">
                        {plan.price_monthly === 0 ? t("pricing.free") : formatCurrency(plan.price_monthly, locale, plan.currency)}
                        {plan.price_monthly === 0 ? null : <span className="text-sm font-normal text-muted-foreground">{t("pricing.perMonth")}</span>}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm text-muted-foreground">
                      <p>{t("pricing.creditsPerMonth", { count: formatNumber(plan.monthly_credits, locale) })}</p>
                      <p>{t("pricing.membersIncluded", { count: plan.max_members })}</p>
                      {plan.description ? <p className="pt-1 text-xs">{plan.description}</p> : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">{t("pricing.note")}</p>
          </div>
        </section>

        {/* Closing call to action */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <div className="panel surface-dots flex flex-col items-center gap-4 p-10 text-center">
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance">{t("cta.title")}</h2>
              <p className="max-w-xl text-sm text-muted-foreground">{t("cta.description")}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {auth ? (
                  <Button size="lg" render={<Link href="/dashboard" />}>
                    {tn("goToDashboard")}
                    <ArrowRight />
                  </Button>
                ) : (
                  <>
                    <Button size="lg" render={<Link href="/sign-up" />}>
                      {t("cta.primary")}
                      <ArrowRight />
                    </Button>
                    <Button size="lg" variant="outline" render={<Link href="/sign-in" />}>
                      {t("cta.secondary")}
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{tc("tagline")}</p>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <CookieConsent />
    </div>
  );
}
