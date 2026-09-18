"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { InlineAlert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authErrorKey } from "@/features/auth/error-map";
import { resetPasswordSchema, type ResetPasswordInput } from "@/features/auth/schemas";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

import { PasswordInput } from "./password-input";

export interface ResetPasswordFormProps {
  supabaseConfigured: boolean;
  /** False when the reset link was not exchanged for a session. */
  hasRecoverySession: boolean;
}

export function ResetPasswordForm({ supabaseConfigured, hasRecoverySession }: ResetPasswordFormProps) {
  const t = useT("auth");
  const te = useT("errors");
  const router = useRouter();
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (!supabaseConfigured) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">{t("resetPassword.title")}</h1>
        </header>
        <InlineAlert tone="attention">{te("supabaseNotConfigured")}</InlineAlert>
      </div>
    );
  }

  async function onSubmit(values: ResetPasswordInput) {
    setFormErrorKey(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setFormErrorKey(authErrorKey(error));
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">{t("resetPassword.success")}</h1>
          <p className="text-sm text-muted-foreground">{t("resetPassword.successDescription")}</p>
        </header>
        <Button className="w-full" render={<Link href="/dashboard" />}>
          {t("resetPassword.continue")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-heading text-lg font-semibold">{t("resetPassword.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("resetPassword.description")}</p>
      </header>

      {!hasRecoverySession ? <InlineAlert tone="attention">{t("resetPassword.missingSession")}</InlineAlert> : null}
      {formErrorKey ? <InlineAlert tone="negative">{t(`errors.${formErrorKey}`)}</InlineAlert> : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">{t("fields.newPassword")}</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder={t("fields.passwordPlaceholder")}
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <FieldError>{errors.password?.message ? t(`validation.${errors.password.message}`) : null}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword">{t("fields.confirmPassword")}</FieldLabel>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register("confirmPassword")}
            />
            <FieldError>{errors.confirmPassword?.message ? t(`validation.${errors.confirmPassword.message}`) : null}</FieldError>
          </Field>
          <Button type="submit" size="lg" disabled={isSubmitting || !hasRecoverySession}>
            {isSubmitting ? <Spinner /> : null}
            {isSubmitting ? t("resetPassword.submitting") : t("resetPassword.submit")}
          </Button>
        </FieldGroup>
      </form>

      <Button variant="ghost" size="sm" className="w-full" render={<Link href="/sign-in" />}>
        {t("forgotPassword.backToSignIn")}
      </Button>
    </div>
  );
}
