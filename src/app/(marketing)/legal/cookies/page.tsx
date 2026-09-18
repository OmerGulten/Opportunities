import type { Metadata } from "next";

import { getRequestLocale } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { LegalArticle, type LegalSectionShape } from "../legal-article";

const SECTIONS: LegalSectionShape = [
  ["s1", 3],
  ["s2", 1],
  ["s3", 1],
  ["s4", 1],
];

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "legal");
  return { title: t("cookies.title"), description: t("cookies.summary") };
}

export default async function CookiesPage() {
  const t = getT(await getRequestLocale(), "legal");
  return <LegalArticle t={t} documentKey="cookies" sections={SECTIONS} />;
}
