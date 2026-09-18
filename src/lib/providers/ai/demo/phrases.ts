import type { Locale, MessageChannel, Tone } from "@/types/common";

/**
 * Fixture sentences for the demo AI provider. This is demo content (like the
 * fictional businesses in lib/demo), not UI copy, which is why it lives here
 * instead of an i18n namespace. Every sentence is neutral and contains no
 * digits of its own: numbers only enter through the facts, so demo output
 * always passes the fact guard.
 */
export interface DemoPhrases {
  greeting(tone: Tone, businessName: string): string;
  intro(senderName: string | null, workspaceName: string): string;
  about(workspaceName: string, companyDescription: string): string;
  observationFinding(title: string, area: string | null): string;
  observationGap(gap: string, area: string | null): string;
  observationWebsite(statusLabel: string): string;
  observationGeneric(area: string | null): string;
  rating(rating: string, reviews: string): string;
  impact(): string;
  opportunity(serviceLabel: string): string;
  offering(name: string, priceRange: string | null, deliveryTime: string | null): string;
  offeringDescription(description: string): string;
  secondaryFinding(title: string): string;
  report(link: string): string;
  cta(tone: Tone, channel: MessageChannel): string;
  signOff(tone: Tone): string;
  subject(businessName: string, serviceLabel: string): string;
  analysis: {
    summaryIntro(name: string, category: string | null, area: string | null, serviceCount: number): string;
    summaryTop(serviceLabel: string, score: number): string;
    summaryNoScores(): string;
    summaryBasis(): string;
    rationaleFromReasons(reasons: string[]): string;
    rationaleScoreOnly(score: number): string;
    pointRating(rating: string, reviews: string): string;
    pointGap(gap: string): string;
    pointWebsite(statusLabel: string): string;
    cautionInstagram(statusLabel: string): string;
    cautionWebsite(statusLabel: string): string;
    cautionLowConfidence(title: string): string;
    cautionNoFindings(): string;
  };
}

/** Strip a trailing sentence terminator so we can embed titles mid-sentence. */
export function clause(text: string): string {
  return text.trim().replace(/[.!?]+$/, "");
}

const tr: DemoPhrases = {
  greeting(tone, name) {
    switch (tone) {
      case "formal":
        return `Sayın ${name} Yetkilisi,`;
      case "casual":
        return `Selam ${name} ekibi,`;
      case "concise":
        return "Merhaba,";
      default:
        return `Merhaba ${name} ekibi,`;
    }
  },
  intro: (senderName, workspaceName) =>
    senderName ? `Ben ${senderName}, ${workspaceName} adına yazıyorum.` : `${workspaceName} adına yazıyorum.`,
  about: (workspaceName, description) => `${workspaceName}: ${clause(description)}.`,
  observationFinding: (title, area) =>
    area
      ? `${area} bölgesindeki işletmeleri incelerken profilinizde şu gözlemi yaptık: ${clause(title)}.`
      : `İşletme profilinizi incelerken şu gözlemi yaptık: ${clause(title)}.`,
  observationGap: (gap, area) =>
    area
      ? `${area} bölgesindeki işletmeleri incelerken Google İşletme profilinizde şu bilginin görünmediğini fark ettik: ${clause(gap)}.`
      : `Google İşletme profilinizde şu bilginin görünmediğini fark ettik: ${clause(gap)}.`,
  observationWebsite: (label) => `Google İşletme profilinizi incelediğimizde web sitesi durumu şöyle görünüyor: ${clause(label)}.`,
  observationGeneric: (area) =>
    area
      ? `${area} bölgesindeki işletmelerin dijital görünürlüğünü incelerken işletmenizi de değerlendirdik.`
      : `Bölgenizdeki işletmelerin dijital görünürlüğünü incelerken işletmenizi de değerlendirdik.`,
  rating: (rating, reviews) => `Google profilinizde ${rating} puan ve ${reviews} yorum bulunuyor.`,
  impact: () => "Bu alan, sizi çevrimiçi arayan kişilerin ilk izleniminde rol oynayabilir.",
  opportunity: (serviceLabel) => `${serviceLabel} kapsamında bu gözlemi somut bir plana dönüştürebiliriz.`,
  offering: (name, price, delivery) =>
    `${name} paketimiz${price ? ` (${price})` : ""} tam da bu ihtiyaç için hazırlandı${delivery ? `; teslim süresi ${clause(delivery)}` : ""}.`,
  offeringDescription: (description) => `Paket kapsamı: ${clause(description)}.`,
  secondaryFinding: (title) => `Ayrıca şunu da not ettik: ${clause(title)}.`,
  report: (link) => `Gözlemlerimizi içeren kısa ön inceleme raporu: ${link}`,
  cta(tone, channel) {
    if (tone === "formal") return "Uygun gördüğünüz bir zamanda kısa bir görüşme yapmaktan memnuniyet duyarız.";
    if (tone === "concise") return "Kısa bir görüşme için uygun musunuz?";
    if (tone === "casual" || channel === "instagram_dm") return "İsterseniz kısaca konuşalım, ne dersiniz?";
    return "Uygun olduğunuz bir zamanda kısa bir görüşme yapmak ister misiniz?";
  },
  signOff(tone) {
    switch (tone) {
      case "formal":
      case "concise":
        return "Saygılarımla,";
      case "casual":
        return "İyi günler,";
      default:
        return "İyi çalışmalar,";
    }
  },
  subject: (businessName, serviceLabel) => `${businessName} için ${serviceLabel} önerisi`,
  analysis: {
    summaryIntro: (name, category, area, count) =>
      `${name}${category ? ` (${category})` : ""}${area ? `, ${area}` : ""} için ${count} hizmet alanı değerlendirildi.`,
    summaryTop: (label, score) => `En yüksek fırsat puanı ${label} alanında (${score}/100).`,
    summaryNoScores: () => "Hizmet puanı hesaplanamadı.",
    summaryBasis: () => "Puanlar yalnızca gözlemlenen sinyallere dayanır; kontrol edilmeyen alanlar ayrıca belirtilmiştir.",
    rationaleFromReasons: (reasons) => `${reasons.map(clause).join("; ")}.`,
    rationaleScoreOnly: (score) => `Bu hizmet için hesaplanan puan ${score}/100.`,
    pointRating: (rating, reviews) => `Google puanı ${rating} (${reviews} yorum).`,
    pointGap: (gap) => `Google İşletme profilinde görünmeyen bilgi: ${clause(gap)}.`,
    pointWebsite: (label) => `Web sitesi durumu: ${clause(label)}.`,
    cautionInstagram: (label) => `Instagram durumu: ${clause(label)}.`,
    cautionWebsite: (label) => `Web sitesi durumu: ${clause(label)}.`,
    cautionLowConfidence: (title) => `Düşük güvenli bulgu: ${clause(title)}.`,
    cautionNoFindings: () => "Denetim bulgusu bulunmuyor; değerlendirme yalnızca profil verilerine dayanıyor.",
  },
};

const en: DemoPhrases = {
  greeting(tone, name) {
    switch (tone) {
      case "formal":
        return `Dear ${name} team,`;
      case "casual":
        return `Hi ${name} team,`;
      case "concise":
        return "Hello,";
      default:
        return `Hello ${name} team,`;
    }
  },
  intro: (senderName, workspaceName) =>
    senderName ? `I am ${senderName}, writing on behalf of ${workspaceName}.` : `I am writing on behalf of ${workspaceName}.`,
  about: (workspaceName, description) => `${workspaceName}: ${clause(description)}.`,
  observationFinding: (title, area) =>
    area
      ? `While reviewing businesses in ${area}, we noticed the following on your profile: ${clause(title)}.`
      : `While reviewing your profile we noticed the following: ${clause(title)}.`,
  observationGap: (gap, area) =>
    area
      ? `While reviewing businesses in ${area}, we noticed that your Google Business profile does not currently show this information: ${clause(gap)}.`
      : `Your Google Business profile does not currently show this information: ${clause(gap)}.`,
  observationWebsite: (label) => `When we looked at your Google Business profile, the website status appeared as: ${clause(label)}.`,
  observationGeneric: (area) =>
    area
      ? `While reviewing the online presence of businesses in ${area}, we also looked at yours.`
      : `While reviewing the online presence of businesses in your area, we also looked at yours.`,
  rating: (rating, reviews) => `Your Google profile shows a ${rating} rating across ${reviews} reviews.`,
  impact: () => "This is one of the things people may notice first when they look you up online.",
  opportunity: (serviceLabel) => `Within ${serviceLabel} we could turn this observation into a concrete plan.`,
  offering: (name, price, delivery) =>
    `Our ${name} package${price ? ` (${price})` : ""} was designed for exactly this need${delivery ? `; delivery time ${clause(delivery)}` : ""}.`,
  offeringDescription: (description) => `What it includes: ${clause(description)}.`,
  secondaryFinding: (title) => `We also noted: ${clause(title)}.`,
  report: (link) => `A short preliminary report with our observations: ${link}`,
  cta(tone, channel) {
    if (tone === "formal") return "We would be glad to arrange a short conversation at a time that suits you.";
    if (tone === "concise") return "Open to a short call?";
    if (tone === "casual" || channel === "instagram_dm") return "Happy to have a quick chat if you are interested, what do you think?";
    return "Would you be open to a short conversation at a time that suits you?";
  },
  signOff(tone) {
    switch (tone) {
      case "formal":
        return "Kind regards,";
      case "concise":
        return "Regards,";
      case "casual":
        return "Cheers,";
      default:
        return "Best regards,";
    }
  },
  subject: (businessName, serviceLabel) => `A ${serviceLabel} idea for ${businessName}`,
  analysis: {
    summaryIntro: (name, category, area, count) =>
      `${name}${category ? ` (${category})` : ""}${area ? `, ${area}` : ""} was assessed across ${count} service areas.`,
    summaryTop: (label, score) => `The highest opportunity score is in ${label} (${score}/100).`,
    summaryNoScores: () => "No service score could be calculated.",
    summaryBasis: () => "Scores rely only on observed signals; items that were not checked are listed separately.",
    rationaleFromReasons: (reasons) => `${reasons.map(clause).join("; ")}.`,
    rationaleScoreOnly: (score) => `The calculated score for this service is ${score}/100.`,
    pointRating: (rating, reviews) => `Google rating ${rating} (${reviews} reviews).`,
    pointGap: (gap) => `Information not shown on the Google Business profile: ${clause(gap)}.`,
    pointWebsite: (label) => `Website status: ${clause(label)}.`,
    cautionInstagram: (label) => `Instagram status: ${clause(label)}.`,
    cautionWebsite: (label) => `Website status: ${clause(label)}.`,
    cautionLowConfidence: (title) => `Low-confidence finding: ${clause(title)}.`,
    cautionNoFindings: () => "No audit findings are available; the assessment relies on profile data only.",
  },
};

export const DEMO_PHRASES: Record<Locale, DemoPhrases> = { tr, en };
