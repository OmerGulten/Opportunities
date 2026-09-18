import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Target } from "lucide-react";

import { DemoBadge, EmptyState, InlineAlert, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { BusinessFactsPanel } from "@/features/messages/components/business-facts-panel";
import { ComposeForm, type ComposeServiceOption, type ComposeTemplateOption } from "@/features/messages/components/compose-form";
import type { BusinessContactLinks } from "@/features/messages/components/channel-links";
import { loadBusinessFacts } from "@/features/messages/facts";
import { getBusinessDetail } from "@/features/businesses/queries";
import { listTemplates } from "@/features/templates/service";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { buildPricingTable } from "@/lib/credits/pricing";
import { listCreditPricingRules, listServices, localizedName } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";
import { isObservationStatus, isWebsiteStatus } from "@/lib/providers/ai/status-labels";
import { getProviderStatus } from "@/lib/providers/registry";
import type { ObservationStatus, Tone } from "@/types/common";
import type { BusinessContactRow, BusinessProviderSnapshotRow, OpportunitySignalRow, PublicReportRow, ServiceOfferingRow } from "@/types/db";
import type { WebsiteStatus } from "@/types/signals";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "messages");
  return { title: t("compose.title") };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ComposeMessagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "messages");
  const params = await searchParams;

  const businessId = firstValue(params.businessId);
  const serviceId = firstValue(params.serviceId) ?? null;

  const breadcrumbs = [
    { label: t("list.title"), href: "/messages" },
    { label: t("compose.title") },
  ];

  if (!businessId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("compose.title")} description={t("compose.subtitle")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon={<Target className="size-5" />}
          title={t("compose.noBusiness.title")}
          description={t("compose.noBusiness.description")}
          action={
            <Button render={<Link href="/opportunities" />}>
              {t("compose.noBusiness.action")}
            </Button>
          }
        />
      </div>
    );
  }

  const [detail, bundle] = await Promise.all([
    getBusinessDetail(ctx, businessId),
    loadBusinessFacts({ supabase: ctx.supabase, workspace: ctx.workspace, businessId, locale: ctx.locale }),
  ]);

  if (!detail || !bundle) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("compose.title")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon={<Building2 className="size-5" />}
          title={t("compose.notFound.title")}
          description={t("compose.notFound.description")}
          action={
            <Button variant="outline" render={<Link href="/opportunities" />}>
              {t("compose.notFound.action")}
            </Button>
          }
        />
      </div>
    );
  }

  const [services, templates, pricingRules, offerings] = await Promise.all([
    listServices(ctx.supabase),
    listTemplates(ctx, { activeOnly: true }),
    listCreditPricingRules(ctx.supabase),
    // The composer shows which offering a service would attach; it has to track
    // the picker, so the whole map goes to the client rather than one lookup.
    ctx.supabase
      .from("service_offerings")
      .select("service_id, name, sort_order")
      .eq("workspace_id", ctx.workspace.id)
      .eq("enabled", true)
      .order("sort_order", { ascending: false })
      .returns<Array<Pick<ServiceOfferingRow, "service_id" | "name" | "sort_order">>>(),
  ]);

  const providerStatus = getProviderStatus();
  const pricing = buildPricingTable(pricingRules);

  // Descending sort order above means the lowest sort_order wins the last write,
  // matching loadOfferingFacts(), which takes the first row ordered ascending.
  const offeringNames: Record<string, string> = {};
  for (const row of offerings.data ?? []) {
    if (row.service_id) offeringNames[row.service_id] = row.name;
  }

  const serviceOptions: ComposeServiceOption[] = services.map((service) => ({ id: service.id, name: localizedName(service, ctx.locale) }));
  const templateOptions: ComposeTemplateOption[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    channel: template.channel,
    serviceId: template.service_id,
    scope: template.scope,
  }));

  const businessName = bundle.facts.businessName || t("list.unknownBusiness");
  const defaultServiceId = serviceId && services.some((service) => service.id === serviceId) ? serviceId : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("compose.title")}
        description={t("compose.forBusiness", { name: businessName })}
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {providerStatus.ai.demo ? <DemoBadge /> : null}
            <Button variant="outline" render={<Link href={`/businesses/${businessId}`} />}>
              <Building2 />
              {t("list.actions.viewBusiness")}
            </Button>
          </div>
        }
      />

      <InlineAlert tone="neutral" title={t("neverSends.title")}>
        {t("neverSends.description")}
      </InlineAlert>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ComposeForm
          businessId={businessId}
          contacts={contactLinks(detail.contacts, bundle.snapshot, bundle.instagramUrl)}
          services={serviceOptions}
          templates={templateOptions}
          offeringNames={offeringNames}
          defaultTone={(ctx.workspace.default_tone as Tone) ?? "friendly_professional"}
          defaultServiceId={defaultServiceId}
          reportLinkAvailable={hasLiveReport(detail.reports)}
          aiMessageCost={pricing.ai_message}
        />

        <BusinessFactsPanel
          locale={ctx.locale}
          facts={bundle.facts}
          sender={bundle.sender}
          websiteStatus={websiteStatusOf(detail.signals, bundle.snapshot)}
          instagramStatus={instagramStatusOf(detail.signals)}
          snapshotStale={detail.snapshotStale}
          reportLinkAvailable={hasLiveReport(detail.reports)}
        />
      </div>
    </div>
  );
}

/** Contact details for the channel deep links; missing ones stay null. */
function contactLinks(contacts: BusinessContactRow[], snapshot: BusinessProviderSnapshotRow | null, instagramUrl: string | null): BusinessContactLinks {
  const byType = (type: BusinessContactRow["type"]) => {
    const matches = contacts.filter((contact) => contact.type === type);
    return (matches.find((contact) => contact.is_primary) ?? matches[0])?.value ?? null;
  };

  return {
    phone: byType("whatsapp") ?? snapshot?.phone_international ?? byType("phone") ?? snapshot?.phone_national ?? null,
    email: byType("email"),
    instagram: byType("instagram") ?? instagramUrl,
  };
}

function signalValue(signals: OpportunitySignalRow[], type: string): string | null {
  const signal = signals.find((row) => row.signal_type === type);
  return typeof signal?.value === "string" ? signal.value : null;
}

function websiteStatusOf(signals: OpportunitySignalRow[], snapshot: BusinessProviderSnapshotRow | null): WebsiteStatus | null {
  const value = signalValue(signals, "website.status");
  if (value && isWebsiteStatus(value)) return value;
  // No signal: the provider snapshot can still tell us a URL was published.
  if (snapshot?.website_uri) return "found";
  return "not_checked";
}

function instagramStatusOf(signals: OpportunitySignalRow[]): ObservationStatus | null {
  const value = signalValue(signals, "instagram.status");
  if (value && isObservationStatus(value)) return value;
  return "not_checked";
}

/** A report link is only offered when one is published, unrevoked and unexpired. */
function hasLiveReport(reports: PublicReportRow[]): boolean {
  return reports.some((report) => !report.revoked_at && (!report.expires_at || new Date(report.expires_at).getTime() > Date.now()));
}
