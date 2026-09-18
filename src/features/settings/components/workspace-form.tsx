"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { updateWorkspace } from "@/features/settings/actions";
import { workspaceProfileSchema } from "@/features/settings/schemas";
import { LOCALE_LABELS } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { LOCALES, TONES, type Locale, type Tone } from "@/types/common";

export interface WorkspaceFormValues {
  name: string;
  slug: string;
  defaultLocale: Locale;
  defaultTone: string;
  senderName: string | null;
  senderTitle: string | null;
  senderPhone: string | null;
  senderEmail: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyDescription: string | null;
  brandPrimaryColor: string | null;
  logoUrl: string | null;
}

export interface WorkspaceFormProps {
  workspace: WorkspaceFormValues;
  canEdit: boolean;
}

const DEFAULT_BRAND_COLOR = "#0f766e";

/** Empty inputs mean "not set", which the schema expects as null rather than "". */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isTone(value: string): value is Tone {
  return (TONES as readonly string[]).includes(value);
}

/**
 * Workspace identity, the sender details used in drafts, and branding.
 *
 * Validation runs against the same Zod schema the server uses, so the field
 * that is actually wrong is the one that gets the message.
 */
export function WorkspaceForm({ workspace, canEdit }: WorkspaceFormProps) {
  const t = useT("settings");
  const tc = useT("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [values, setValues] = useState({
    name: workspace.name,
    defaultLocale: workspace.defaultLocale,
    defaultTone: isTone(workspace.defaultTone) ? workspace.defaultTone : "friendly_professional",
    senderName: workspace.senderName ?? "",
    senderTitle: workspace.senderTitle ?? "",
    senderPhone: workspace.senderPhone ?? "",
    senderEmail: workspace.senderEmail ?? "",
    companyName: workspace.companyName ?? "",
    companyWebsite: workspace.companyWebsite ?? "",
    companyDescription: workspace.companyDescription ?? "",
    brandPrimaryColor: workspace.brandPrimaryColor ?? "",
    logoUrl: workspace.logoUrl ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoFailed, setLogoFailed] = useState(false);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "logoUrl") setLogoFailed(false);
  }

  function messageForPath(path: string): string {
    if (path === "brandPrimaryColor") return t("errors.invalidColor");
    if (path === "companyWebsite" || path === "logoUrl") return t("errors.invalidUrl");
    if (path === "senderEmail") return t("errors.invalidEmail");
    if (path === "name") return t("errors.nameRequired");
    return t("errors.saveFailed");
  }

  function submit() {
    const payload = {
      name: values.name.trim(),
      defaultLocale: values.defaultLocale,
      defaultTone: values.defaultTone,
      senderName: orNull(values.senderName),
      senderTitle: orNull(values.senderTitle),
      senderPhone: orNull(values.senderPhone),
      senderEmail: orNull(values.senderEmail),
      companyName: orNull(values.companyName),
      companyWebsite: orNull(values.companyWebsite),
      companyDescription: orNull(values.companyDescription),
      brandPrimaryColor: orNull(values.brandPrimaryColor),
      logoUrl: orNull(values.logoUrl),
    };

    const parsed = workspaceProfileSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        next[path] = messageForPath(path);
      }
      setErrors(next);
      toast.error(t("errors.saveFailed"));
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await updateWorkspace(parsed.data);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  const disabled = !canEdit || pending;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("workspace.identity.title")}</CardTitle>
          <CardDescription>{t("workspace.identity.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="workspace-name">{t("workspace.name")}</FieldLabel>
              <Input
                id="workspace-name"
                value={values.name}
                maxLength={80}
                disabled={disabled}
                onChange={(event) => set("name", event.target.value)}
                aria-invalid={Boolean(errors.name) || undefined}
              />
              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="workspace-slug">{t("workspace.slug")}</FieldLabel>
              <Input id="workspace-slug" value={workspace.slug} readOnly disabled />
              <FieldDescription>{t("workspace.slugHint")}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="workspace-locale">{t("workspace.defaultLocale")}</FieldLabel>
              <Select
                value={values.defaultLocale}
                disabled={disabled}
                onValueChange={(value) => {
                  if (typeof value === "string") set("defaultLocale", value as Locale);
                }}
              >
                <SelectTrigger id="workspace-locale" className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {LOCALE_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t("workspace.defaultLocaleHint")}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="workspace-tone">{t("workspace.defaultTone")}</FieldLabel>
              <Select
                value={values.defaultTone}
                disabled={disabled}
                onValueChange={(value) => {
                  if (typeof value === "string") set("defaultTone", value);
                }}
              >
                <SelectTrigger id="workspace-tone" className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {tc(`tone.${tone}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t("workspace.defaultToneHint")}</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("workspace.sender.title")}</CardTitle>
          <CardDescription>{t("workspace.sender.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="sender-name">{t("workspace.sender.name")}</FieldLabel>
              <Input id="sender-name" value={values.senderName} maxLength={120} disabled={disabled} onChange={(event) => set("senderName", event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="sender-title">{t("workspace.sender.role")}</FieldLabel>
              <Input id="sender-title" value={values.senderTitle} maxLength={120} disabled={disabled} onChange={(event) => set("senderTitle", event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="sender-phone">{t("workspace.sender.phone")}</FieldLabel>
              <Input id="sender-phone" value={values.senderPhone} maxLength={40} disabled={disabled} onChange={(event) => set("senderPhone", event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="sender-email">{t("workspace.sender.email")}</FieldLabel>
              <Input
                id="sender-email"
                type="email"
                value={values.senderEmail}
                disabled={disabled}
                onChange={(event) => set("senderEmail", event.target.value)}
                aria-invalid={Boolean(errors.senderEmail) || undefined}
              />
              {errors.senderEmail ? <FieldError>{errors.senderEmail}</FieldError> : null}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("workspace.company.title")}</CardTitle>
          <CardDescription>{t("workspace.company.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="company-name">{t("workspace.company.name")}</FieldLabel>
                <Input id="company-name" value={values.companyName} maxLength={120} disabled={disabled} onChange={(event) => set("companyName", event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="company-website">{t("workspace.company.website")}</FieldLabel>
                <Input
                  id="company-website"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={values.companyWebsite}
                  disabled={disabled}
                  onChange={(event) => set("companyWebsite", event.target.value)}
                  aria-invalid={Boolean(errors.companyWebsite) || undefined}
                />
                {errors.companyWebsite ? <FieldError>{errors.companyWebsite}</FieldError> : null}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="company-description">{t("workspace.company.descriptionField")}</FieldLabel>
              <Textarea
                id="company-description"
                rows={3}
                maxLength={1000}
                value={values.companyDescription}
                disabled={disabled}
                onChange={(event) => set("companyDescription", event.target.value)}
              />
              <FieldDescription>{t("workspace.company.descriptionHint")}</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("workspace.branding.title")}</CardTitle>
          <CardDescription>{t("workspace.branding.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="brand-color">{t("workspace.branding.color")}</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="brand-color-picker"
                  type="color"
                  aria-label={t("workspace.branding.color")}
                  className="h-8 w-12 p-1"
                  value={values.brandPrimaryColor || DEFAULT_BRAND_COLOR}
                  disabled={disabled}
                  onChange={(event) => set("brandPrimaryColor", event.target.value)}
                />
                <Input
                  id="brand-color"
                  value={values.brandPrimaryColor}
                  placeholder={DEFAULT_BRAND_COLOR}
                  maxLength={7}
                  className="w-40 font-mono"
                  disabled={disabled}
                  onChange={(event) => set("brandPrimaryColor", event.target.value)}
                  aria-invalid={Boolean(errors.brandPrimaryColor) || undefined}
                />
              </div>
              <FieldDescription>{t("workspace.branding.colorHint")}</FieldDescription>
              {errors.brandPrimaryColor ? <FieldError>{errors.brandPrimaryColor}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="logo-url">{t("workspace.branding.logoUrl")}</FieldLabel>
              <Input
                id="logo-url"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={values.logoUrl}
                disabled={disabled}
                onChange={(event) => set("logoUrl", event.target.value)}
                aria-invalid={Boolean(errors.logoUrl) || undefined}
              />
              <FieldDescription>{t("workspace.branding.logoHint")}</FieldDescription>
              {errors.logoUrl ? <FieldError>{errors.logoUrl}</FieldError> : null}
              {values.logoUrl.trim().length > 0 ? (
                <div className="mt-2 flex items-center gap-3">
                  {logoFailed ? (
                    <p className="text-xs text-muted-foreground">{t("workspace.branding.logoPreviewFailed")}</p>
                  ) : (
                    // A workspace logo can live on any host, so next/image (which needs
                    // configured remote patterns) cannot render it. onError keeps the
                    // UI honest about an address that does not resolve to an image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={values.logoUrl}
                      alt={t("workspace.branding.logoPreview")}
                      className="h-10 w-auto max-w-40 rounded-md bg-muted object-contain p-1"
                      onError={() => setLogoFailed(true)}
                    />
                  )}
                </div>
              ) : null}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {canEdit ? (
        <div className="flex justify-end">
          <Button onClick={submit} disabled={disabled}>
            {pending ? <Spinner /> : null}
            {pending ? t("common.saving") : tc("actions.save")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
