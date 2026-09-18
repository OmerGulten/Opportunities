import type { Metadata } from "next";

import { InlineAlert, Section } from "@/components/shared";
import { OfferingsManager, type BillingPeriod } from "@/features/settings/components/offerings-manager";
import { ServicesForm } from "@/features/settings/components/services-form";
import { listOfferings } from "@/features/settings/service";
import { hasRole, requireWorkspaceContext } from "@/lib/auth/context";
import { listServices, localizedDescription, localizedName } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";
import type { WorkspaceServiceRow } from "@/types/db";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkspaceContext();
  return { title: getT(ctx.locale, "services")("title") };
}

/** Which services the workspace sells, plus the packages it offers for them. */
export default async function ServicesSettingsPage() {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "services");
  const ts = getT(ctx.locale, "settings");
  const canEdit = hasRole(ctx.role, "admin");

  const [services, offerings, workspaceServices] = await Promise.all([
    listServices(ctx.supabase),
    listOfferings(ctx),
    ctx.supabase
      .from("workspace_services")
      .select("service_id, enabled")
      .eq("workspace_id", ctx.workspace.id)
      .returns<Array<Pick<WorkspaceServiceRow, "service_id" | "enabled">>>(),
  ]);

  const enabledIds = new Set((workspaceServices.data ?? []).filter((row) => row.enabled).map((row) => row.service_id));

  const serviceOptions = services.map((service) => ({
    id: service.id,
    key: service.key,
    name: localizedName(service, ctx.locale),
    description: localizedDescription(service, ctx.locale),
    icon: service.icon,
    enabled: enabledIds.has(service.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      {canEdit ? null : <InlineAlert tone="neutral">{ts("common.adminOnly")}</InlineAlert>}

      <Section title={t("title")} description={t("description")}>
        <ServicesForm services={serviceOptions} canEdit={canEdit} />
      </Section>

      <OfferingsManager
        canEdit={canEdit}
        services={serviceOptions.map((service) => ({ id: service.id, name: service.name, icon: service.icon }))}
        offerings={offerings.map((offering) => ({
          id: offering.id,
          serviceId: offering.service_id,
          name: offering.name,
          description: offering.description,
          priceFrom: offering.price_from,
          priceTo: offering.price_to,
          currency: offering.currency,
          billingPeriod: offering.billing_period as BillingPeriod,
          deliveryTime: offering.delivery_time,
          promptContext: offering.prompt_context,
          enabled: offering.enabled,
          sortOrder: offering.sort_order,
        }))}
      />
    </div>
  );
}
