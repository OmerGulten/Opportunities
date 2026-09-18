import type { Metadata } from "next";

import { getRequestLocale } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { LegalArticle, type LegalSectionShape } from "../legal-article";

const SECTIONS: LegalSectionShape = [
  ["s1", 2],
  ["s2", 3],
  ["s3", 2],
  ["s4", 2],
  ["s5", 2],
];

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "legal");
  return { title: t("ai.title"), description: t("ai.summary") };
}

export default async function AiDisclosurePage() {
  const t = getT(await getRequestLocale(), "legal");
  return <LegalArticle t={t} documentKey="ai" sections={SECTIONS} />;
}
