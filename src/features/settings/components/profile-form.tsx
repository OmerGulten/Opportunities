"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { updateProfile } from "@/features/settings/actions";
import { LOCALE_LABELS } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/types/common";

export interface ProfileFormProps {
  displayName: string | null;
  email: string | null;
  locale: Locale;
}

/** Account-level profile: display name and interface language. */
export function ProfileForm({ displayName, email, locale }: ProfileFormProps) {
  const t = useT("settings");
  const tc = useT("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(displayName ?? "");
  const [language, setLanguage] = useState<Locale>(locale);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t("errors.nameRequired"));
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await updateProfile({ displayName: trimmed, locale: language });
      if (!result.ok) {
        setError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.title")}</CardTitle>
        <CardDescription>{t("profile.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="profile-display-name">{t("profile.displayName")}</FieldLabel>
            <Input
              id="profile-display-name"
              value={name}
              maxLength={80}
              placeholder={t("profile.displayNamePlaceholder")}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={error !== null || undefined}
            />
            <FieldDescription>{t("profile.displayNameHint")}</FieldDescription>
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="profile-email">{t("profile.email")}</FieldLabel>
            <Input id="profile-email" value={email ?? ""} readOnly disabled autoComplete="off" />
            <FieldDescription>{t("profile.emailHint")}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="profile-locale">{t("profile.locale")}</FieldLabel>
            <Select
              value={language}
              onValueChange={(value) => {
                if (typeof value === "string") setLanguage(value as Locale);
              }}
            >
              <SelectTrigger id="profile-locale" className="w-full sm:w-56">
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
            <FieldDescription>{t("profile.localeHint")}</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button onClick={submit} disabled={pending}>
          {pending ? <Spinner /> : null}
          {pending ? t("common.saving") : tc("actions.save")}
        </Button>
      </CardFooter>
    </Card>
  );
}
