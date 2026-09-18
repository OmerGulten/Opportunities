import type { Metadata } from "next";

import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { firstParam, safeNextPath } from "@/features/auth/schemas";
import { getRequestLocale } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/config/env";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "auth");
  return { title: t("signUp.title") };
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;

  return <SignUpForm supabaseConfigured={isSupabaseConfigured()} next={safeNextPath(firstParam(params.next), "/onboarding")} />;
}
