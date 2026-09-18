"use client";

import Link from "next/link";

import { EmptyState, InlineAlert, ServiceIcon } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

import { OptionCard } from "./option-card";
import type { ScanFormApi, ServiceOption } from "./types";

export interface ServicesStepProps {
  form: ScanFormApi;
  services: ServiceOption[];
  errorMessage: string | null;
}

/**
 * Step 3 — which of the workspace's services the results should be scored for.
 * Only enabled services are offered; scoring rules exist per service, so a
 * service that is not sold would only add noise.
 */
export function ServicesStep({ form, services, errorMessage }: ServicesStepProps) {
  const t = useT("scans");
  const selected = form.watch("serviceIds") ?? [];

  function toggle(serviceId: string) {
    const next = selected.includes(serviceId) ? selected.filter((id) => id !== serviceId) : [...selected, serviceId];
    form.setValue("serviceIds", next, { shouldValidate: true, shouldDirty: true });
  }

  if (services.length === 0) {
    return (
      <EmptyState
        title={t("wizard.services.emptyTitle")}
        description={t("wizard.services.emptyBody")}
        action={
          <Button variant="outline" render={<Link href="/settings/services" />}>
            {t("wizard.services.goToSettings")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("wizard.services.selectedCount", { count: selected.length })}</p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => form.setValue("serviceIds", services.map((service) => service.id), { shouldValidate: true, shouldDirty: true })}
          >
            {t("wizard.services.selectAll")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={selected.length === 0}
            onClick={() => form.setValue("serviceIds", [], { shouldValidate: true, shouldDirty: true })}
          >
            {t("wizard.services.clear")}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {services.map((service) => (
          <OptionCard
            key={service.id}
            selected={selected.includes(service.id)}
            onToggle={() => toggle(service.id)}
            icon={<ServiceIcon icon={service.icon} colored />}
            title={service.name}
            description={service.description}
          />
        ))}
      </div>

      <InlineAlert tone="neutral">{t("wizard.services.scoringNote")}</InlineAlert>
      <FieldError>{errorMessage}</FieldError>
    </div>
  );
}
