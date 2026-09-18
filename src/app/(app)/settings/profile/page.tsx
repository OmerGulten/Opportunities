import type { Metadata } from "next";

import { DeleteAccountCard } from "@/features/settings/components/danger-zone";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkspaceContext();
  return { title: getT(ctx.locale, "settings")("profile.title") };
}

/** Account-level settings: the signed-in user's own profile. */
export default async function ProfileSettingsPage() {
  const ctx = await requireWorkspaceContext();

  return (
    <div className="flex flex-col gap-6">
      <ProfileForm displayName={ctx.profile.display_name} email={ctx.profile.email ?? ctx.user.email} locale={ctx.locale} />
      <DeleteAccountCard />
    </div>
  );
}
