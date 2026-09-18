import type { Metadata } from "next";

import { SignInForm } from "@/features/auth/components/sign-in-form";
import { isAuthErrorKey } from "@/features/auth/error-map";
import { firstParam, safeNextPath } from "@/features/auth/schemas";
import { getRequestLocale } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/config/env";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "auth");
  return { title: t("signIn.title") };
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const errorKey = firstParam(params.error);

  return (
    <SignInForm
      supabaseConfigured={isSupabaseConfigured()}
      next={safeNextPath(firstParam(params.next))}
      initialErrorKey={isAuthErrorKey(errorKey) ? errorKey : undefined}
    />
  );
}
