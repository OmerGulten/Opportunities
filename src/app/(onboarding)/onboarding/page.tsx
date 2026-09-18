import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { firstParam } from "@/features/auth/schemas";
import { OnboardingWizard, type OnboardingService } from "@/features/workspace/components/onboarding-wizard";
import { getRequestLocale, getWorkspaceContext, requireAuth } from "@/lib/auth/context";
import { listServices, localizedDescription, localizedName } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "onboarding");
  return { title: t("title") };
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await requireAuth();
  const params = await searchParams;
  const mode = firstParam(params.new) === "1" ? "additional" : "initial";

  const workspaceContext = await getWorkspaceContext();
  const locale = await getRequestLocale();

  // Nothing left to do: a workspace exists and onboarding was completed.
  if (mode === "initial" && workspaceContext && auth.profile.onboarding_completed_at) {
    redirect("/dashboard");
  }

  let services: OnboardingService[] = [];
  try {
    const rows = await listServices(auth.supabase);
    services = rows.map((row) => ({
      id: row.id,
      key: row.key,
      name: localizedName(row, locale),
      description: localizedDescription(row, locale),
      icon: row.icon,
    }));
  } catch {
    // Reference data is unavailable; the wizard states this instead of
    // pretending the workspace sells nothing.
    services = [];
  }

  return (
    <OnboardingWizard
      services={services}
      mode={mode}
      hasWorkspace={Boolean(workspaceContext)}
      initialWorkspaceName={mode === "additional" ? "" : (workspaceContext?.workspace.name ?? "")}
      initialDisplayName={auth.profile.display_name ?? ""}
    />
  );
}
