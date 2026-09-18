import type { Metadata } from "next";

import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getAuthContext, getRequestLocale } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/config/env";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "auth");
  return { title: t("resetPassword.title") };
}

/**
 * Reached through /auth/callback after the recovery link is exchanged for a
 * session. Without that session Supabase cannot update the password, so the
 * form explains how to get a fresh link instead of failing silently.
 */
export default async function ResetPasswordPage() {
  const configured = isSupabaseConfigured();
  const auth = configured ? await getAuthContext() : null;

  return <ResetPasswordForm supabaseConfigured={configured} hasRecoverySession={Boolean(auth)} />;
}
