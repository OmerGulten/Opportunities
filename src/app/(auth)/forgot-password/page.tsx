import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { getRequestLocale } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/config/env";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "auth");
  return { title: t("forgotPassword.title") };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm supabaseConfigured={isSupabaseConfigured()} />;
}
