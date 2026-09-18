import { FileX } from "lucide-react";

import { ReportNotice } from "@/features/reports/components/report-notice";
import { getRequestLocale } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

/** Shown for a token that resolves to nothing. No branding, no business name. */
export default async function ReportNotFound() {
  const locale = await getRequestLocale();
  const t = getT(locale, "reports");

  return <ReportNotice icon={<FileX className="size-5" aria-hidden />} title={t("public.states.notFoundTitle")} description={t("public.states.notFoundDescription")} />;
}
