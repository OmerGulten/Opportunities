"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
import { ArrowLeft, ArrowRight, Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { InlineAlert, NotExhaustiveNotice, ProgressSteps } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createScanSchema, type CreateScanInput } from "@/features/scans/schemas";
import { useT } from "@/lib/i18n/client";

import { CreditEstimatePanel } from "../credit-estimate-panel";
import { CategoriesStep } from "./categories-step";
import { DepthStep } from "./depth-step";
import { FiltersStep } from "./filters-step";
import { LocationStep } from "./location-step";
import { ReviewStep } from "./review-step";
import type { CategoryOption, ScanFormValues, ScanLimits, ServiceOption } from "./types";
import { ServicesStep } from "./services-step";
import { useScanEstimate } from "./use-scan-estimate";

const STEPS = ["location", "categories", "services", "depth", "filters", "review"] as const;
type StepId = (typeof STEPS)[number];

const STEP_FIELDS: Record<StepId, Array<FieldPath<ScanFormValues>>> = {
  location: ["locationMethod", "center", "radiusM", "polygon"],
  categories: ["categoryIds"],
  services: ["serviceIds"],
  depth: ["auditDepth", "maxBusinesses"],
  filters: ["filters"],
  review: [],
};

export interface NewScanWizardProps {
  categories: CategoryOption[];
  services: ServiceOption[];
  limits: ScanLimits;
  /** Platform feature flag for the competitor benchmark. */
  benchmarkEnabled: boolean;
  /** True when the place provider is serving demo data. */
  isDemo: boolean;
}

/**
 * New Scan wizard. The form holds exactly the shape `createScanSchema` accepts
 * and every step edits a slice of it; the server re-plans and re-prices the scan
 * on submit, so nothing here can understate what a scan will cost.
 */
export function NewScanWizard({ categories, services, limits, benchmarkEnabled, isDemo }: NewScanWizardProps) {
  const t = useT("scans");
  const te = useT("errors");
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitErrorCode, setSubmitErrorCode] = useState<string | null>(null);

  const form = useForm<ScanFormValues, unknown, CreateScanInput>({
    resolver: zodResolver(createScanSchema),
    mode: "onChange",
    defaultValues: {
      name: undefined,
      locationMethod: "place",
      placeLabel: null,
      center: null,
      radiusM: 2000,
      polygon: null,
      categoryIds: [],
      serviceIds: services.map((service) => service.id),
      auditDepth: "basic",
      maxBusinesses: Math.min(100, limits.maxBusinesses),
      filters: {
        website: "any",
        instagram: "any",
        google: [],
        minReviews: null,
        maxReviews: null,
        minRating: null,
        maxRating: null,
        includeBenchmark: false,
      },
    },
  });

  // `useWatch` rather than `form.watch()`: the latter subscribes by mutating the
  // form instance during render, which makes the React Compiler skip this
  // component entirely ("Use of incompatible library").
  const values = useWatch({ control: form.control });
  const estimate = useScanEstimate(values, true);
  const step = STEPS[stepIndex] ?? "location";
  const isLast = stepIndex === STEPS.length - 1;
  const errors = form.formState.errors;

  const areaError = errors.polygon
    ? t("wizard.location.errors.polygon")
    : errors.center
      ? t("wizard.location.errors.center")
      : errors.radiusM
        ? t("wizard.location.errors.radius")
        : null;
  const filtersError = errors.filters ? t("wizard.filters.rangeError") : null;

  async function goNext() {
    const fields = STEP_FIELDS[step];
    const valid = fields.length === 0 ? true : await form.trigger(fields);
    if (!valid) return;
    setStepIndex((index) => Math.min(STEPS.length - 1, index + 1));
  }

  function goBack() {
    setSubmitErrorCode(null);
    setStepIndex((index) => Math.max(0, index - 1));
  }

  async function onSubmit(input: CreateScanInput) {
    // Enter inside a text field must not start a scan from an earlier step.
    if (!isLast) {
      await goNext();
      return;
    }
    setSubmitting(true);
    setSubmitErrorCode(null);
    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as { data?: { scan?: { id?: string } }; error?: { code?: string } };
      if (!response.ok) {
        const code = payload.error?.code ?? "internal_error";
        setSubmitErrorCode(code);
        toast.error(te(code));
        return;
      }
      const scanId = payload.data?.scan?.id;
      toast.success(t("wizard.submit.started"));
      router.push(scanId ? `/scans/${scanId}` : "/scans");
      router.refresh();
    } catch {
      setSubmitErrorCode("internal_error");
      toast.error(te("internal_error"));
    } finally {
      setSubmitting(false);
    }
  }

  const blockedByCredits = estimate.estimate !== null && !estimate.estimate.sufficient;
  const showSidebar = !isLast;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <ProgressSteps
        steps={STEPS.map((id) => ({ id, label: t(`wizard.steps.${id}`) }))}
        current={stepIndex}
        onStepClick={submitting ? undefined : (index) => setStepIndex(index)}
      />

      <div className={cn("grid gap-6", showSidebar && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
        <div className="panel flex min-w-0 flex-col gap-5 p-5">
          <div className="space-y-1">
            <h2 className="font-heading text-base font-medium">{t(`wizard.${step}.title`)}</h2>
            <p className="text-sm text-muted-foreground">{t(`wizard.${step}.description`)}</p>
          </div>

          {submitErrorCode ? <InlineAlert tone="negative">{te(submitErrorCode)}</InlineAlert> : null}

          {step === "location" ? <LocationStep form={form} limits={limits} errorMessage={areaError} /> : null}
          {step === "categories" ? (
            <CategoriesStep form={form} categories={categories} errorMessage={errors.categoryIds ? t("wizard.categories.error") : null} />
          ) : null}
          {step === "services" ? (
            <ServicesStep form={form} services={services} errorMessage={errors.serviceIds ? t("wizard.services.error") : null} />
          ) : null}
          {step === "depth" ? <DepthStep form={form} limits={limits} /> : null}
          {step === "filters" ? <FiltersStep form={form} benchmarkEnabled={benchmarkEnabled} errorMessage={filtersError} /> : null}
          {step === "review" ? (
            <ReviewStep form={form} categories={categories} services={services} estimate={estimate} isDemo={isDemo} />
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={goBack} disabled={submitting || stepIndex === 0}>
              <ArrowLeft />
              {t("wizard.actions.back")}
            </Button>
            {isLast ? (
              <Button type="submit" disabled={submitting || blockedByCredits}>
                {submitting ? <Spinner /> : <Radar />}
                {submitting ? t("wizard.actions.starting") : t("wizard.actions.start")}
              </Button>
            ) : (
              <Button type="button" onClick={goNext}>
                {t("wizard.actions.next")}
                <ArrowRight />
              </Button>
            )}
          </div>
        </div>

        {showSidebar ? (
          <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
            <CreditEstimatePanel estimate={estimate.estimate} status={estimate.status} errorCode={estimate.errorCode} />
            <NotExhaustiveNotice />
          </aside>
        ) : null}
      </div>
    </form>
  );
}
