import type { Metadata } from "next";

import { InlineAlert } from "@/components/shared";
import { TeamManager } from "@/features/settings/components/team-manager";
import { listTeam } from "@/features/settings/service";
import { hasRole, requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkspaceContext();
  return { title: getT(ctx.locale, "settings")("team.title") };
}

/** Members, roles and invitation links. No invitation e-mail is ever sent. */
export default async function TeamSettingsPage() {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "settings");
  const canManage = hasRole(ctx.role, "admin");
  const members = await listTeam(ctx);

  return (
    <div className="flex flex-col gap-6">
      {canManage ? null : <InlineAlert tone="neutral">{t("common.adminOnly")}</InlineAlert>}
      <TeamManager members={members} currentUserId={ctx.user.id} canManage={canManage} canGrantOwner={ctx.role === "owner"} />
    </div>
  );
}
