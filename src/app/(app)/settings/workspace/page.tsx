import type { Metadata } from "next";

import { InlineAlert } from "@/components/shared";
import { DeleteWorkspaceCard } from "@/features/settings/components/danger-zone";
import { WorkspaceForm } from "@/features/settings/components/workspace-form";
import { hasRole, requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "settings");
  return { title: t("workspace.title"), description: t("workspace.description") };
}

/** Workspace identity, sender details, branding and deletion. */
export default async function WorkspaceSettingsPage() {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "settings");
  const canEdit = hasRole(ctx.role, "admin");
  const workspace = ctx.workspace;

  return (
    <div className="flex flex-col gap-6">
      {canEdit ? null : <InlineAlert tone="neutral">{t("common.adminOnly")}</InlineAlert>}

      <WorkspaceForm
        canEdit={canEdit}
        workspace={{
          name: workspace.name,
          slug: workspace.slug,
          defaultLocale: workspace.default_locale,
          defaultTone: workspace.default_tone,
          senderName: workspace.sender_name,
          senderTitle: workspace.sender_title,
          senderPhone: workspace.sender_phone,
          senderEmail: workspace.sender_email,
          companyName: workspace.company_name,
          companyWebsite: workspace.company_website,
          companyDescription: workspace.company_description,
          brandPrimaryColor: workspace.brand_primary_color,
          logoUrl: workspace.logo_url,
        }}
      />

      <DeleteWorkspaceCard workspaceName={workspace.name} isOwner={ctx.role === "owner"} />
    </div>
  );
}
