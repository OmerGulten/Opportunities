"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { InlineAlert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authErrorKey } from "@/features/auth/error-map";
import { magicLinkSchema, signInSchema, type SignInInput } from "@/features/auth/schemas";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

import { PasswordInput } from "./password-input";

export interface SignInFormProps {
  supabaseConfigured: boolean;
  /** Validated, same-origin path to continue to after signing in. */
  next: string;
  /** Key in the `auth.errors` namespace, forwarded by /auth/callback. */
  initialErrorKey?: string;
}

export function SignInForm({ supabaseConfigured, next, initialErrorKey }: SignInFormProps) {
  const t = useT("auth");
  const te = useT("errors");
  const router = useRouter();
  const [formErrorKey, setFormErrorKey] = useState<string | null>(initialErrorKey ?? null);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);
  const [magicLinkPending, setMagicLinkPending] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  if (!supabaseConfigured) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">{t("signIn.title")}</h1>
        </header>
        <InlineAlert tone="attention">{te("supabaseNotConfigured")}</InlineAlert>
      </div>
    );
  }

  async function onSubmit(values: SignInInput) {
    setFormErrorKey(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
    if (error) {
      setFormErrorKey(authErrorKey(error));
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function sendMagicLink() {
    setFormErrorKey(null);
    const email = getValues("email");
    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) {
      setFormErrorKey("generic");
      return;
    }
    setMagicLinkPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        setFormErrorKey(authErrorKey(error));
        return;
      }
      setMagicLinkSentTo(parsed.data.email);
    } finally {
      setMagicLinkPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-heading text-lg font-semibold">{t("signIn.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("signIn.description")}</p>
      </header>

      {formErrorKey ? <InlineAlert tone="negative">{t(`errors.${formErrorKey}`)}</InlineAlert> : null}
      {magicLinkSentTo ? (
        <InlineAlert tone="positive" title={t("signIn.magicLinkSent")}>
          {t("signIn.magicLinkSentDescription", { email: magicLinkSentTo })}
        </InlineAlert>
      ) : null}

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

          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password">{t("fields.password")}</FieldLabel>
              <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                {t("signIn.forgotPassword")}
              </Link>
            </div>
            <PasswordInput id="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
            <FieldError>{errors.password?.message ? t(`validation.${errors.password.message}`) : null}</FieldError>
          </Field>

          <Button type="submit" size="lg" disabled={isSubmitting || magicLinkPending}>
            {isSubmitting ? <Spinner /> : null}
            {isSubmitting ? t("signIn.submitting") : t("signIn.submit")}
          </Button>

          <FieldSeparator>{t("signIn.orSeparator")}</FieldSeparator>

          <Field>
            <Button type="button" variant="outline" size="lg" onClick={sendMagicLink} disabled={isSubmitting || magicLinkPending}>
              {magicLinkPending ? <Spinner /> : <Mail />}
              {magicLinkPending ? t("signIn.magicLinkSubmitting") : t("signIn.magicLink")}
            </Button>
            <FieldDescription>{t("signIn.magicLinkHint")}</FieldDescription>
          </Field>
        </FieldGroup>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("signIn.noAccount")}{" "}
        <Link href="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("signIn.createAccount")}
        </Link>
      </p>
    </div>
  );
}
