import { redirect } from "next/navigation";

/** /settings has no content of its own; the first section is the profile. */
export default function SettingsIndexPage() {
  redirect("/settings/profile");
}
