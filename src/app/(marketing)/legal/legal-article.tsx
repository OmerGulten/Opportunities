import type { TFunction } from "@/lib/i18n";

/** [sectionKey, paragraphCount] — MessageTree has no arrays, so pages declare shape here. */
export type LegalSectionShape = ReadonlyArray<readonly [string, number]>;

export interface LegalArticleProps {
  /** Translator bound to the `legal` namespace. */
  t: TFunction;
  /** Key prefix inside the namespace: "terms", "privacy", "cookies", "ai". */
  documentKey: string;
  sections: LegalSectionShape;
}

/**
 * Renders one legal document from the `legal` i18n namespace, including a
 * table of contents built from the same declared shape.
 */
export function LegalArticle({ t, documentKey, sections }: LegalArticleProps) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="space-y-3 border-b pb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">{t(`${documentKey}.title`)}</h1>
        <p className="text-sm text-muted-foreground">{t(`${documentKey}.summary`)}</p>
        <p className="text-xs text-muted-foreground">{t("meta.lastUpdated", { date: t("meta.effectiveDate") })}</p>
      </header>

      <nav aria-label={t("meta.tocTitle")} className="border-b py-6">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("meta.tocTitle")}</p>
        <ol className="space-y-1 text-sm">
          {sections.map(([sectionKey]) => (
            <li key={sectionKey}>
              <a href={`#${documentKey}-${sectionKey}`} className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
                {t(`${documentKey}.${sectionKey}.title`)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="divide-y divide-border">
        {sections.map(([sectionKey, paragraphCount]) => (
          <section key={sectionKey} id={`${documentKey}-${sectionKey}`} className="scroll-mt-20 space-y-3 py-6">
            <h2 className="font-heading text-base font-medium">{t(`${documentKey}.${sectionKey}.title`)}</h2>
            {Array.from({ length: paragraphCount }, (_, index) => (
              <p key={index} className="text-sm leading-relaxed text-muted-foreground">
                {t(`${documentKey}.${sectionKey}.p${index + 1}`)}
              </p>
            ))}
          </section>
        ))}
      </div>

      <footer className="space-y-2 border-t pt-6">
        <h2 className="font-heading text-base font-medium">{t("meta.contactTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("meta.contactBody")}</p>
      </footer>
    </article>
  );
}
