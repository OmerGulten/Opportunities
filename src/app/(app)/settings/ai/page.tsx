import type { Metadata } from "next";

import { InlineAlert } from "@/components/shared";
import { AiSettingsForm } from "@/features/settings/components/ai-settings-form";
import { hasRole, requireWorkspaceContext } from "@/lib/auth/context";
import { getAISettings } from "@/lib/db/settings";
import { getT } from "@/lib/i18n";
import { getProviderStatus } from "@/lib/providers/registry";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkspaceContext();
  return { title: getT(ctx.locale, "settings")("ai.title") };
}

/** Workspace tone, the read-only model configuration and the AI disclosure. */
export default async function AiSettingsPage() {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "settings");
  const canEdit = hasRole(ctx.role, "admin");
  const ai = await getAISettings();
  const status = getProviderStatus();

  return (
    <div className="flex flex-col gap-6">
      {canEdit ? null : <InlineAlert tone="neutral">{t("common.adminOnly")}</InlineAlert>}
      <AiSettingsForm
        canEdit={canEdit}
        defaultTone={ctx.workspace.default_tone || ai.default_tone}
        provider={{ name: status.ai.provider, model: status.ai.model, demo: status.ai.demo }}
        promptVersion={ai.prompt_version}
        maxOutputTokens={ai.max_output_tokens}
        temperature={ai.temperature}
      />
    </div>
  );
}
