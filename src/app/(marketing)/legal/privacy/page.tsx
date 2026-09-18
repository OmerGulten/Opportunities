import type { Metadata } from "next";

import { getRequestLocale } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { LegalArticle, type LegalSectionShape } from "../legal-article";

const SECTIONS: LegalSectionShape = [
  ["s1", 2],
  ["s2", 3],
  ["s3", 3],
  ["s4", 4],
  ["s5", 3],
  ["s6", 3],
  ["s7", 2],
  ["s8", 2],
  ["s9", 2],
  ["s10", 1],
];

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "legal");
  return { title: t("privacy.title"), description: t("privacy.summary") };
}

export default async function PrivacyPage() {
  const t = getT(await getRequestLocale(), "legal");
  return <LegalArticle t={t} documentKey="privacy" sections={SECTIONS} />;
}
