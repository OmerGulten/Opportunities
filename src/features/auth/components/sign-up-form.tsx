"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { InlineAlert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authErrorKey } from "@/features/auth/error-map";
import { signUpSchema, type SignUpInput } from "@/features/auth/schemas";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

import { PasswordInput } from "./password-input";

export interface SignUpFormProps {
  supabaseConfigured: boolean;
  /** Where to continue once the email is confirmed. */
  next: string;
}

export function SignUpForm({ supabaseConfigured, next }: SignUpFormProps) {
  const t = useT("auth");
  const te = useT("errors");
  const router = useRouter();
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "", acceptTerms: false },
  });

  if (!supabaseConfigured) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">{t("signUp.title")}</h1>
        </header>
        <InlineAlert tone="attention">{te("supabaseNotConfigured")}</InlineAlert>
      </div>
    );
  }

  async function onSubmit(values: SignUpInput) {
    setFormErrorKey(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setFormErrorKey(authErrorKey(error));
      return;
    }

    // A session is returned only when email confirmation is disabled.
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }
    setConfirmationSentTo(values.email);
  }

  if (confirmationSentTo) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">{t("signUp.checkEmail")}</h1>
        </header>
        <InlineAlert tone="positive">{t("signUp.checkEmailDescription", { email: confirmationSentTo })}</InlineAlert>
        <Button variant="outline" className="w-full" render={<Link href="/sign-in" />}>
          {t("forgotPassword.backToSignIn")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-heading text-lg font-semibold">{t("signUp.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("signUp.description")}</p>
      </header>

      {formErrorKey ? <InlineAlert tone="negative">{t(`errors.${formErrorKey}`)}</InlineAlert> : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="displayName">{t("fields.displayName")}</FieldLabel>
            <Input
              id="displayName"
              autoComplete="name"
              placeholder={t("fields.displayNamePlaceholder")}
              aria-invalid={Boolean(errors.displayName)}
              {...register("displayName")}
            />
            <FieldError>{errors.displayName?.message ? t(`validation.${errors.displayName.message}`) : null}</FieldError>
          </Field>

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

          <Field>
            <FieldLabel htmlFor="password">{t("fields.password")}</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder={t("fields.passwordPlaceholder")}
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <FieldError>{errors.password?.message ? t(`validation.${errors.password.message}`) : null}</FieldError>
          </Field>

          <Field orientation="horizontal">
            <Controller
              control={control}
              name="acceptTerms"
              render={({ field }) => (
                <Checkbox
                  id="acceptTerms"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  onBlur={field.onBlur}
                  aria-invalid={Boolean(errors.acceptTerms)}
                />
              )}
            />
            <FieldDescription>
              {t("signUp.termsPrefix")}{" "}
              <Link href="/legal/terms" className="underline underline-offset-4">
                {t("signUp.termsLink")}
              </Link>{" "}
              {t("signUp.termsMiddle")}{" "}
              <Link href="/legal/privacy" className="underline underline-offset-4">
                {t("signUp.privacyLink")}
              </Link>
              {t("signUp.termsSuffix")}
            </FieldDescription>
          </Field>
          <FieldError>{errors.acceptTerms?.message ? t(`validation.${errors.acceptTerms.message}`) : null}</FieldError>

          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            {isSubmitting ? t("signUp.submitting") : t("signUp.submit")}
          </Button>
        </FieldGroup>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("signUp.haveAccount")}{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("signUp.signInLink")}
        </Link>
      </p>
    </div>
  );
}
