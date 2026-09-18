"use client";

import { cn } from "cn";
import { ArrowLeft, ArrowRight, Check, PartyPopper, Radar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert, ProgressSteps, ServiceIcon } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  completeOnboarding,
  createWorkspace,
  saveDisplayName,
  saveOfferings,
  saveWorkspaceProfile,
  saveWorkspaceServices,
} from "@/features/workspace/actions";
import { createWorkspaceSchema, displayNameSchema, workspaceServicesSchema } from "@/features/workspace/schemas";
import type { TFunction } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { slugify } from "@/lib/utils/slug";
import { TONES, type Tone } from "@/types/common";

export interface OnboardingService {
  id: string;
  key: string;
  /** Already localized for the request locale. */
  name: string;
  description: string | null;
  icon: string | null;
}

interface OfferingDraft {
  name: string;
  priceFrom: string;
  priceTo: string;
  currency: string;
  billingPeriod: "one_time" | "monthly" | "yearly";
  deliveryTime: string;
}

type StepId = "workspace" | "profile" | "services" | "offerings" | "tone" | "sender" | "company" | "done";

const CURRENCIES = ["TRY", "USD", "EUR"];
const BILLING_PERIODS: Array<OfferingDraft["billingPeriod"]> = ["one_time", "monthly", "yearly"];

export interface OnboardingWizardProps {
  services: OnboardingService[];
  /** `additional` creates another workspace and skips account-level steps. */
  mode: "initial" | "additional";
  hasWorkspace: boolean;
  initialWorkspaceName: string;
  initialDisplayName: string;
}

export function OnboardingWizard({ services, mode, hasWorkspace, initialWorkspaceName, initialDisplayName }: OnboardingWizardProps) {
  const t = useT("onboarding");
  const tc = useT("common");
  const router = useRouter();

  const steps: StepId[] = [
    ...((mode === "additional" || !hasWorkspace ? ["workspace"] : []) as StepId[]),
    ...((mode === "initial" ? ["profile"] : []) as StepId[]),
    "services",
    "offerings",
    "tone",
    "sender",
    "company",
    "done",
  ];

  const [stepIndex, setStepIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrorKey, setFieldErrorKey] = useState<string | null>(null);

  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() => services.map((service) => service.id));
  const [offerings, setOfferings] = useState<Record<string, OfferingDraft>>(() => buildDefaultOfferings(services, t));
  const [tone, setTone] = useState<Tone>("friendly_professional");
  const [senderName, setSenderName] = useState("");
  const [senderTitle, setSenderTitle] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");

  const step = steps[stepIndex];
  const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id));

  function updateOffering(serviceId: string, patch: Partial<OfferingDraft>) {
    setOfferings((current) => ({ ...current, [serviceId]: { ...current[serviceId], ...patch } }));
  }

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId],
    );
  }

  function goBack() {
    setErrorMessage(null);
    setFieldErrorKey(null);
    setStepIndex((index) => Math.max(0, index - 1));
  }

  function advance() {
    setErrorMessage(null);
    setFieldErrorKey(null);
    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  }

  function profileValues() {
    return {
      defaultTone: tone,
      senderName: senderName.trim() || null,
      senderTitle: senderTitle.trim() || null,
      senderPhone: senderPhone.trim() || null,
      senderEmail: senderEmail.trim() || null,
      companyName: companyName.trim() || null,
      companyWebsite: companyWebsite.trim() || null,
      companyDescription: companyDescription.trim() || null,
    };
  }

  async function submitStep() {
    setPending(true);
    setErrorMessage(null);
    setFieldErrorKey(null);
    try {
      switch (step) {
        case "workspace": {
          const parsed = createWorkspaceSchema.safeParse({ name: workspaceName });
          if (!parsed.success) {
            setFieldErrorKey(parsed.error.issues[0]?.message ?? "nameRequired");
            return;
          }
          const result = await createWorkspace({ name: parsed.data.name });
          if (!result.ok) {
            setErrorMessage(result.error.message);
            return;
          }
          router.refresh();
          break;
        }
        case "profile": {
          const parsed = displayNameSchema.safeParse({ displayName });
          if (!parsed.success) {
            setFieldErrorKey(parsed.error.issues[0]?.message ?? "displayNameRequired");
            return;
          }
          const result = await saveDisplayName({ displayName: parsed.data.displayName });
          if (!result.ok) {
            setErrorMessage(result.error.message);
            return;
          }
          break;
        }
        case "services": {
          const parsed = workspaceServicesSchema.safeParse({ serviceIds: selectedServiceIds });
          if (!parsed.success) {
            setFieldErrorKey(parsed.error.issues[0]?.message ?? "atLeastOneService");
            return;
          }
          const result = await saveWorkspaceServices({ serviceIds: parsed.data.serviceIds });
          if (!result.ok) {
            setErrorMessage(result.error.message);
            return;
          }
          break;
        }
        case "offerings": {
          const payload = selectedServices.map((service) => {
            const draft = offerings[service.id] ?? emptyDraft(service.name);
            return {
              serviceId: service.id,
              name: draft.name.trim(),
              priceFrom: parsePrice(draft.priceFrom),
              priceTo: parsePrice(draft.priceTo),
              currency: draft.currency,
              billingPeriod: draft.billingPeriod,
              deliveryTime: draft.deliveryTime.trim() || null,
            };
          });
          const invalid = payload.find((offering) => offering.name.length === 0);
          if (invalid) {
            setFieldErrorKey("offeringNameRequired");
            return;
          }
          const outOfRange = payload.find(
            (offering) => offering.priceFrom !== null && offering.priceTo !== null && offering.priceTo < offering.priceFrom,
          );
          if (outOfRange) {
            setFieldErrorKey("priceRange");
            return;
          }
          const result = await saveOfferings({ offerings: payload });
          if (!result.ok) {
            setErrorMessage(result.error.message);
            return;
          }
          break;
        }
        case "tone":
        case "sender": {
          const result = await saveWorkspaceProfile(profileValues());
          if (!result.ok) {
            setErrorMessage(result.error.message);
            return;
          }
          break;
        }
        case "company": {
          const result = await saveWorkspaceProfile(profileValues());
          if (!result.ok) {
            setErrorMessage(result.error.message);
            return;
          }
          const completed = await completeOnboarding();
          if (!completed.ok) {
            setErrorMessage(completed.error.message);
            return;
          }
          router.refresh();
          break;
        }
        default:
          break;
      }
      advance();
    } finally {
      setPending(false);
    }
  }

  const progressSteps = steps.map((id) => ({ id, label: t(`steps.${id}.label`) }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="space-y-1.5">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{mode === "additional" ? t("newWorkspaceTitle") : t("title")}</h1>
        <p className="text-sm text-muted-foreground">{mode === "additional" ? t("newWorkspaceSubtitle") : t("subtitle")}</p>
      </header>

      <ProgressSteps steps={progressSteps} current={stepIndex} onStepClick={pending ? undefined : (index) => setStepIndex(index)} />

      <div className="panel space-y-5 p-5">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-medium">{t(`steps.${step}.title`)}</h2>
          <p className="text-sm text-muted-foreground">{t(`steps.${step}.description`)}</p>
        </div>

        {errorMessage ? <InlineAlert tone="negative">{errorMessage}</InlineAlert> : null}

        {step === "workspace" ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="workspaceName">{t("workspace.nameLabel")}</FieldLabel>
              <Input
                id="workspaceName"
                value={workspaceName}
                placeholder={t("workspace.namePlaceholder")}
                onChange={(event) => setWorkspaceName(event.target.value)}
                aria-invalid={Boolean(fieldErrorKey)}
              />
              <FieldDescription>{t("workspace.nameHint")}</FieldDescription>
              <FieldError>{fieldErrorKey ? t(`errors.${fieldErrorKey}`) : null}</FieldError>
            </Field>
            <Field>
              <FieldLabel>{t("workspace.slugPreview")}</FieldLabel>
              <p className="rounded-lg bg-muted px-2.5 py-1.5 font-mono text-sm text-muted-foreground">
                /{slugify(workspaceName || "workspace")}-<span className="opacity-60">····</span>
              </p>
              <FieldDescription>{t("workspace.slugHint")}</FieldDescription>
            </Field>
          </FieldGroup>
        ) : null}

        {step === "profile" ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="displayName">{t("profile.displayNameLabel")}</FieldLabel>
              <Input
                id="displayName"
                value={displayName}
                placeholder={t("profile.displayNamePlaceholder")}
                onChange={(event) => setDisplayName(event.target.value)}
                aria-invalid={Boolean(fieldErrorKey)}
              />
              <FieldDescription>{t("profile.displayNameHint")}</FieldDescription>
              <FieldError>{fieldErrorKey ? t(`errors.${fieldErrorKey}`) : null}</FieldError>
            </Field>
          </FieldGroup>
        ) : null}

        {step === "services" ? (
          <div className="space-y-3">
            {services.length === 0 ? (
              <InlineAlert tone="attention">{t("services.empty")}</InlineAlert>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">{t("services.selectedCount", { count: selectedServiceIds.length })}</p>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedServiceIds(services.map((service) => service.id))}>
                      {t("services.selectAll")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedServiceIds([])}>
                      {t("services.clearAll")}
                    </Button>
                  </div>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {services.map((service) => {
                    const selected = selectedServiceIds.includes(service.id);
                    return (
                      <li key={service.id}>
                        <button
                          type="button"
                          onClick={() => toggleService(service.id)}
                          aria-pressed={selected}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            selected ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/50",
                          )}
                        >
                          <ServiceIcon icon={service.icon} colored className="mt-0.5" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{service.name}</span>
                            {service.description ? <span className="block text-xs text-muted-foreground">{service.description}</span> : null}
                          </span>
                          {selected ? <Check className="mt-0.5 size-4 text-primary" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {fieldErrorKey ? <p className="text-sm text-destructive">{t(`errors.${fieldErrorKey}`)}</p> : null}
              </>
            )}
          </div>
        ) : null}

        {step === "offerings" ? (
          <div className="space-y-4">
            {selectedServices.length === 0 ? (
              <InlineAlert tone="neutral">{t("offerings.none")}</InlineAlert>
            ) : (
              selectedServices.map((service) => {
                const draft = offerings[service.id] ?? emptyDraft(service.name);
                return (
                  <fieldset key={service.id} className="space-y-3 rounded-lg border p-3">
                    <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
                      <ServiceIcon icon={service.icon} colored className="size-3.5" />
                      {t("offerings.forService", { service: service.name })}
                    </legend>
                    <Field>
                      <FieldLabel htmlFor={`offering-name-${service.id}`}>{t("offerings.nameLabel")}</FieldLabel>
                      <Input
                        id={`offering-name-${service.id}`}
                        value={draft.name}
                        onChange={(event) => updateOffering(service.id, { name: event.target.value })}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor={`offering-from-${service.id}`}>{t("offerings.priceFromLabel")}</FieldLabel>
                        <Input
                          id={`offering-from-${service.id}`}
                          type="number"
                          min={0}
                          inputMode="decimal"
                          value={draft.priceFrom}
                          onChange={(event) => updateOffering(service.id, { priceFrom: event.target.value })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`offering-to-${service.id}`}>{t("offerings.priceToLabel")}</FieldLabel>
                        <Input
                          id={`offering-to-${service.id}`}
                          type="number"
                          min={0}
                          inputMode="decimal"
                          value={draft.priceTo}
                          onChange={(event) => updateOffering(service.id, { priceTo: event.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field>
                        <FieldLabel>{t("offerings.currencyLabel")}</FieldLabel>
                        <Select
                          value={draft.currency}
                          onValueChange={(value) => {
                            if (typeof value === "string") updateOffering(service.id, { currency: value });
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((currency) => (
                              <SelectItem key={currency} value={currency}>
                                {currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>{t("offerings.billingPeriodLabel")}</FieldLabel>
                        <Select
                          value={draft.billingPeriod}
                          onValueChange={(value) => {
                            if (isBillingPeriod(value)) updateOffering(service.id, { billingPeriod: value });
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BILLING_PERIODS.map((period) => (
                              <SelectItem key={period} value={period}>
                                {t(`offerings.billing.${period}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`offering-delivery-${service.id}`}>{t("offerings.deliveryTimeLabel")}</FieldLabel>
                        <Input
                          id={`offering-delivery-${service.id}`}
                          value={draft.deliveryTime}
                          placeholder={t("offerings.deliveryTimePlaceholder")}
                          onChange={(event) => updateOffering(service.id, { deliveryTime: event.target.value })}
                        />
                      </Field>
                    </div>
                  </fieldset>
                );
              })
            )}
            <p className="text-xs text-muted-foreground">{t("offerings.priceHint")}</p>
            {fieldErrorKey ? <p className="text-sm text-destructive">{t(`errors.${fieldErrorKey}`)}</p> : null}
          </div>
        ) : null}

        {step === "tone" ? (
          <FieldGroup>
            <Field>
              <FieldLabel>{t("tone.label")}</FieldLabel>
              <Select
                value={tone}
                onValueChange={(value) => {
                  if (isTone(value)) setTone(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tc(`tone.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t("tone.hint")}</FieldDescription>
            </Field>
          </FieldGroup>
        ) : null}

        {step === "sender" ? (
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="senderName">{t("sender.nameLabel")}</FieldLabel>
                <Input id="senderName" value={senderName} onChange={(event) => setSenderName(event.target.value)} autoComplete="name" />
              </Field>
              <Field>
                <FieldLabel htmlFor="senderTitle">{t("sender.titleLabel")}</FieldLabel>
                <Input
                  id="senderTitle"
                  value={senderTitle}
                  placeholder={t("sender.titlePlaceholder")}
                  onChange={(event) => setSenderTitle(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="senderPhone">{t("sender.phoneLabel")}</FieldLabel>
                <Input id="senderPhone" value={senderPhone} onChange={(event) => setSenderPhone(event.target.value)} autoComplete="tel" />
              </Field>
              <Field>
                <FieldLabel htmlFor="senderEmail">{t("sender.emailLabel")}</FieldLabel>
                <Input
                  id="senderEmail"
                  type="email"
                  value={senderEmail}
                  onChange={(event) => setSenderEmail(event.target.value)}
                  autoComplete="email"
                />
              </Field>
            </div>
            <FieldDescription>{tc("optional")}</FieldDescription>
          </FieldGroup>
        ) : null}

        {step === "company" ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="companyName">{t("company.nameLabel")}</FieldLabel>
              <Input id="companyName" value={companyName} onChange={(event) => setCompanyName(event.target.value)} autoComplete="organization" />
            </Field>
            <Field>
              <FieldLabel htmlFor="companyWebsite">{t("company.websiteLabel")}</FieldLabel>
              <Input
                id="companyWebsite"
                type="url"
                inputMode="url"
                value={companyWebsite}
                placeholder={t("company.websitePlaceholder")}
                onChange={(event) => setCompanyWebsite(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="companyDescription">{t("company.descriptionLabel")}</FieldLabel>
              <Textarea
                id="companyDescription"
                rows={3}
                value={companyDescription}
                placeholder={t("company.descriptionPlaceholder")}
                onChange={(event) => setCompanyDescription(event.target.value)}
              />
              <FieldDescription>{t("company.descriptionHint")}</FieldDescription>
            </Field>
          </FieldGroup>
        ) : null}

        {step === "done" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-3">
              <PartyPopper className="size-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{t("done.heading")}</p>
                <p className="text-sm text-muted-foreground">{t("done.body")}</p>
              </div>
            </div>
            <dl className="divide-y divide-border text-sm">
              <SummaryRow label={t("done.summaryWorkspace")} value={workspaceName || initialWorkspaceName} />
              <SummaryRow label={t("done.summaryServices")} value={selectedServices.map((service) => service.name).join(", ") || "–"} />
              <SummaryRow label={t("done.summaryOfferings")} value={String(selectedServices.length)} />
              <SummaryRow label={t("done.summaryTone")} value={tc(`tone.${tone}`)} />
            </dl>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="sm:flex-1" render={<Link href="/scans/new" />}>
                <Radar />
                {t("done.startScan")}
              </Button>
              <Button variant="outline" className="sm:flex-1" render={<Link href="/dashboard" />}>
                {t("done.goToDashboard")}
              </Button>
            </div>
          </div>
        ) : null}

        {step !== "done" ? (
          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={goBack} disabled={pending || stepIndex === 0}>
              <ArrowLeft />
              {t("actions.back")}
            </Button>
            <div className="flex items-center gap-2">
              {isOptionalStep(step) ? (
                <Button type="button" variant="ghost" onClick={submitStep} disabled={pending}>
                  {t("actions.skip")}
                </Button>
              ) : null}
              <Button type="button" onClick={submitStep} disabled={pending}>
                {pending ? <Spinner /> : null}
                {pending ? t("actions.saving") : isLastInputStep(steps, stepIndex) ? t("actions.finish") : t("actions.next")}
                {!pending ? <ArrowRight /> : null}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="text-muted-foreground sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value}</dd>
    </div>
  );
}

function isOptionalStep(step: StepId): boolean {
  return step === "sender" || step === "company";
}

function isLastInputStep(steps: StepId[], index: number): boolean {
  return steps[index + 1] === "done";
}

function isBillingPeriod(value: unknown): value is OfferingDraft["billingPeriod"] {
  return value === "one_time" || value === "monthly" || value === "yearly";
}

function isTone(value: unknown): value is Tone {
  return typeof value === "string" && (TONES as readonly string[]).includes(value);
}

function parsePrice(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function emptyDraft(serviceName: string): OfferingDraft {
  return { name: serviceName, priceFrom: "", priceTo: "", currency: "TRY", billingPeriod: "one_time", deliveryTime: "" };
}

/** One suggested package per service, using the per-service copy when present. */
function buildDefaultOfferings(services: OnboardingService[], t: TFunction): Record<string, OfferingDraft> {
  const drafts: Record<string, OfferingDraft> = {};
  for (const service of services) {
    const nameKey = `suggestions.${service.key}.name`;
    const deliveryKey = `suggestions.${service.key}.delivery`;
    const name = t(nameKey);
    const delivery = t(deliveryKey);
    drafts[service.id] = {
      name: name === nameKey ? t("suggestions.default.name", { service: service.name }) : name,
      priceFrom: "",
      priceTo: "",
      currency: "TRY",
      billingPeriod: service.key === "seo" || service.key === "social_media" || service.key === "review_management" ? "monthly" : "one_time",
      deliveryTime: delivery === deliveryKey ? t("suggestions.default.delivery") : delivery,
    };
  }
  return drafts;
}
