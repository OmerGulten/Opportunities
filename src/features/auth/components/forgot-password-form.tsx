"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { InlineAlert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authErrorKey } from "@/features/auth/error-map";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/schemas";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

export interface ForgotPasswordFormProps {
  supabaseConfigured: boolean;
}

export function ForgotPasswordForm({ supabaseConfigured }: ForgotPasswordFormProps) {
  const t = useT("auth");
  const te = useT("errors");
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  if (!supabaseConfigured) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">{t("forgotPassword.title")}</h1>
        </header>
        <InlineAlert tone="attention">{te("supabaseNotConfigured")}</InlineAlert>
      </div>
    );
  }

  async function onSubmit(values: ForgotPasswordInput) {
    setFormErrorKey(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    if (error) {
      setFormErrorKey(authErrorKey(error));
      return;
    }
    setSentTo(values.email);
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-heading text-lg font-semibold">{t("forgotPassword.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("forgotPassword.description")}</p>
      </header>

      {formErrorKey ? <InlineAlert tone="negative">{t(`errors.${formErrorKey}`)}</InlineAlert> : null}

      {sentTo ? (
        <InlineAlert tone="positive" title={t("forgotPassword.sent")}>
          {t("forgotPassword.sentDescription", { email: sentTo })}
        </InlineAlert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{t("fields.email")}</FieldLabel>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("fields.emailPlaceholder")}
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              <FieldError>{errors.email?.message ? t(`validation.${errors.email.message}`) : null}</FieldError>
            </Field>
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              {isSubmitting ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
            </Button>
          </FieldGroup>
        </form>
      )}

      <Button variant="ghost" size="sm" className="w-full" render={<Link href="/sign-in" />}>
        <ArrowLeft />
        {t("forgotPassword.backToSignIn")}
      </Button>
    </div>
  );
}
