import type { Metadata } from "next";

import { InlineAlert } from "@/components/shared";
import { ApiKeysManager, type ApiKeyItem } from "@/features/settings/components/api-keys-manager";
import { listApiKeys } from "@/features/settings/service";
import { hasRole, requireWorkspaceContext } from "@/lib/auth/context";
import { getFeatureFlags } from "@/lib/db/settings";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkspaceContext();
  return { title: getT(ctx.locale, "settings")("apiKeys.title") };
}

/**
 * API keys.
 *
 * Only admins can read the rows (RLS enforces it), so a member sees the rule
 * rather than an empty table with no explanation.
 */
export default async function ApiKeysSettingsPage() {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "settings");
  const canManage = hasRole(ctx.role, "admin");

  const flags = await getFeatureFlags();
  const keys = canManage ? await listApiKeys(ctx) : [];

  const items: ApiKeyItem[] = keys.map((key) => ({
    id: key.id,
    name: key.name,
    prefix: key.key_prefix,
    createdAt: key.created_at,
    lastUsedAt: key.last_used_at,
    revokedAt: key.revoked_at,
  }));

  if (!canManage) {
    return <InlineAlert tone="neutral">{t("common.adminOnly")}</InlineAlert>;
  }

  return <ApiKeysManager keys={items} canManage={canManage} enabled={flags.api_keys} />;
}
