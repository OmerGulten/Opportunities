import type { Metadata } from "next";

import { getRequestLocale } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { LegalArticle, type LegalSectionShape } from "../legal-article";

const SECTIONS: LegalSectionShape = [
  ["s1", 2],
  ["s2", 3],
  ["s3", 2],
  ["s4", 3],
  ["s5", 3],
  ["s6", 2],
  ["s7", 2],
  ["s8", 2],
  ["s9", 2],
];

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "legal");
  return { title: t("terms.title"), description: t("terms.summary") };
}

export default async function TermsPage() {
  const t = getT(await getRequestLocale(), "legal");
  return <LegalArticle t={t} documentKey="terms" sections={SECTIONS} />;
}
