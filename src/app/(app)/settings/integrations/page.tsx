import type { Metadata } from "next";

import { IntegrationsStatus, type IntegrationStatusItem } from "@/features/settings/components/integrations-status";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { isRealPaymentsEnabled } from "@/lib/billing";
import { publicEnv, serverEnv } from "@/lib/config/env";
import { getT } from "@/lib/i18n";
import { getProviderStatus } from "@/lib/providers/registry";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkspaceContext();
  return { title: getT(ctx.locale, "settings")("integrations.title") };
}

/**
 * Read-only provider status.
 *
 * Only *whether* a credential is configured is read from the environment — the
 * values never leave the server, and nothing here is editable from the UI.
 */
export default async function IntegrationsSettingsPage() {
  await requireWorkspaceContext();

  const status = getProviderStatus();
  const env = serverEnv();
  const realPayments = await isRealPaymentsEnabled();

  const items: IntegrationStatusItem[] = [
    {
      key: "places",
      envVar: "GOOGLE_PLACES_API_KEY",
      configured: Boolean(env.GOOGLE_PLACES_API_KEY),
      demo: status.places.demo,
    },
    {
      key: "ai",
      envVar: "OPENAI_API_KEY",
      configured: Boolean(env.OPENAI_API_KEY),
      demo: status.ai.demo,
      detail: status.ai.model,
    },
    {
      key: "performance",
      envVar: "GOOGLE_PAGESPEED_API_KEY",
      configured: Boolean(env.GOOGLE_PAGESPEED_API_KEY),
      demo: status.performance.demo,
    },
    {
      key: "maps",
      envVar: "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY",
      configured: Boolean(publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY),
      demo: !publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
    },
    {
      key: "billing",
      envVar: "FEATURE_REAL_PAYMENTS",
      configured: realPayments,
      demo: !realPayments,
      detail: env.BILLING_PROVIDER,
    },
  ];

  return <IntegrationsStatus items={items} forcedDemo={status.forced} heuristicPerformance={status.performance.demo} />;
}
