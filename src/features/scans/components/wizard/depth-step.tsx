"use client";

import { Check, Minus } from "lucide-react";

import { InlineAlert } from "@/components/shared";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import type { AuditDepth } from "@/types/common";

import { OptionCard } from "./option-card";
import type { ScanFormApi, ScanLimits } from "./types";

const DEPTHS: AuditDepth[] = ["discovery", "basic", "deep"];

const CHECK_KEYS = ["profile", "details", "website", "instagram", "reviews", "performance"] as const;

/**
 * What each depth actually runs, mirroring `runBusinessAudit` and the Places
 * field masks. Anything not run is reported as `not_checked`, never as absent.
 */
const DEPTH_CHECKS: Record<AuditDepth, Record<(typeof CHECK_KEYS)[number], boolean>> = {
  discovery: { profile: true, details: false, website: false, instagram: false, reviews: false, performance: false },
  basic: { profile: true, details: true, website: true, instagram: true, reviews: false, performance: false },
  deep: { profile: true, details: true, website: true, instagram: true, reviews: true, performance: true },
};

export interface DepthStepProps {
  form: ScanFormApi;
  limits: ScanLimits;
}

/** Step 4 — how deeply each discovered business is audited. */
export function DepthStep({ form, limits }: DepthStepProps) {
  const t = useT("scans");
  const depth = form.watch("auditDepth") ?? "basic";
  const maxBusinesses = form.watch("maxBusinesses") ?? limits.maxBusinesses;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2">
        {DEPTHS.map((option) => (
          <OptionCard
            key={option}
            role="radio"
            selected={option === depth}
            onToggle={() => form.setValue("auditDepth", option, { shouldValidate: true, shouldDirty: true })}
            title={t(`wizard.depth.options.${option}.label`)}
            description={t(`wizard.depth.options.${option}.description`)}
          >
            <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {CHECK_KEYS.map((checkKey) => {
                const included = DEPTH_CHECKS[option][checkKey];
                return (
                  <li key={checkKey} className="flex items-center gap-1.5 text-xs">
                    {included ? (
                      <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    ) : (
                      <Minus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className={included ? "text-foreground" : "text-muted-foreground"}>
                      {t(`wizard.depth.checks.${checkKey}`)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </OptionCard>
        ))}
      </div>

      <InlineAlert tone="neutral">{t("wizard.depth.notCheckedNote")}</InlineAlert>

      <Field>
        <FieldLabel htmlFor="max-businesses">{t("wizard.depth.maxBusinesses")}</FieldLabel>
        <Input
          id="max-businesses"
          type="number"
          inputMode="numeric"
          className="w-32"
          min={1}
          max={limits.maxBusinesses}
          value={String(maxBusinesses)}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            const clamped = Math.round(Math.min(limits.maxBusinesses, Math.max(1, next)));
            form.setValue("maxBusinesses", clamped, { shouldValidate: true, shouldDirty: true });
          }}
        />
        <FieldDescription>{t("wizard.depth.maxBusinessesHint", { max: limits.maxBusinesses })}</FieldDescription>
      </Field>
    </div>
  );
}
