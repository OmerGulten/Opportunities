import type { ServiceDefinition, ServiceRule } from "@/types/scoring";
import { SIGNAL_TYPES } from "@/types/signals";

/**
 * TypeScript mirror of the "Services" and "Service rules" blocks in
 * supabase/seed.sql. Keep the two in sync: the seed is the source of truth for
 * the database, this file is the offline fallback and the test oracle.
 */

export type DefaultServiceSeed = Omit<ServiceDefinition, "id">;

export interface DefaultRuleSeed extends Omit<ServiceRule, "id" | "serviceId"> {
  serviceKey: string;
}

export const DEFAULT_RULES_VERSION = 1;

export const DEFAULT_SERVICES: readonly DefaultServiceSeed[] = [
  { key: "website_development", nameTr: "Web Sitesi Geliştirme", nameEn: "Website Development", scoreNormalizer: 100, sortOrder: 10, active: true },
  { key: "seo", nameTr: "SEO", nameEn: "SEO", scoreNormalizer: 100, sortOrder: 20, active: true },
  { key: "social_media", nameTr: "Sosyal Medya Yönetimi", nameEn: "Social Media Management", scoreNormalizer: 100, sortOrder: 30, active: true },
  { key: "google_business", nameTr: "Google İşletme Optimizasyonu", nameEn: "Google Business Optimization", scoreNormalizer: 100, sortOrder: 40, active: true },
  { key: "review_management", nameTr: "Yorum Yönetimi", nameEn: "Review Management", scoreNormalizer: 100, sortOrder: 50, active: true },
  { key: "branding", nameTr: "Marka & Logo", nameEn: "Branding & Logo", scoreNormalizer: 100, sortOrder: 60, active: true },
] as const;

const NO_WEBSITE_VALUES = ["not_found", "invalid", "unreachable"];

type RuleTuple = [
  serviceKey: string,
  key: string,
  nameTr: string,
  nameEn: string,
  explanationTr: string,
  explanationEn: string,
  signalType: string,
  operator: ServiceRule["operator"],
  value: ServiceRule["value"],
  points: number,
  minConfidence: ServiceRule["minConfidence"],
  requiresDepth: ServiceRule["requiresDepth"],
  sortOrder: number,
];

// Same column order as the seed's `with r(...)` block, one tuple per seed row.
const RULE_TUPLES: readonly RuleTuple[] = [
  // Website Development
  ["website_development", "no_website", "Web sitesi bulunamadı", "No website found", "İşletme profilinde web sitesi bağlantısı bulunamadı.", "No website URL was found on the business profile.", SIGNAL_TYPES.WEBSITE_STATUS, "in", NO_WEBSITE_VALUES, 55, "medium", "discovery", 10],
  ["website_development", "weak_website", "Zayıf web sitesi", "Weak website", "Web sitesi denetimi düşük kalite sinyalleri gösteriyor.", "The website audit shows low quality signals.", SIGNAL_TYPES.WEBSITE_QUALITY, "eq", "weak", 30, "medium", "basic", 20],
  ["website_development", "average_website", "Geliştirilebilir web sitesi", "Website could be improved", "Web sitesi denetimi orta düzey kalite sinyalleri gösteriyor.", "The website audit shows average quality signals.", SIGNAL_TYPES.WEBSITE_QUALITY, "eq", "average", 10, "medium", "basic", 25],
  ["website_development", "no_cta", "Görünür eylem çağrısı yok", "No visible call to action", "Sayfada görünür bir eylem çağrısı (ara, rezervasyon, iletişim) tespit edilmedi.", "No visible call to action (call, book, contact) was detected on the page.", SIGNAL_TYPES.WEBSITE_HAS_CTA, "is_false", null, 10, "medium", "basic", 30],
  ["website_development", "no_contact_info", "İletişim bilgisi yok", "No contact information", "Sayfada telefon, adres veya iletişim bilgisi tespit edilmedi.", "No phone, address or contact information was detected on the page.", SIGNAL_TYPES.WEBSITE_HAS_CONTACT_INFO, "is_false", null, 10, "medium", "basic", 40],
  ["website_development", "no_booking", "Rezervasyon akışı yok", "No booking flow", "Online rezervasyon veya randevu akışı tespit edilmedi.", "No online booking or appointment flow was detected.", SIGNAL_TYPES.WEBSITE_HAS_BOOKING, "is_false", null, 5, "medium", "basic", 50],
  ["website_development", "not_mobile_friendly", "Mobil uyum zayıf", "Weak mobile friendliness", "Sezgisel kontroller mobil uyumun zayıf olduğunu gösteriyor.", "Heuristic checks indicate weak mobile friendliness.", SIGNAL_TYPES.WEBSITE_MOBILE_FRIENDLY, "is_false", null, 10, "low", "basic", 60],
  ["website_development", "no_https", "HTTPS yok", "No HTTPS", "Web sitesi güvenli bağlantı (HTTPS) kullanmıyor.", "The website does not use a secure connection (HTTPS).", SIGNAL_TYPES.WEBSITE_HTTPS, "is_false", null, 10, "high", "basic", 70],
  // SEO
  ["seo", "no_website", "Web sitesi bulunamadı", "No website found", "Web sitesi olmadan arama görünürlüğü sınırlıdır.", "Search visibility is limited without a website.", SIGNAL_TYPES.WEBSITE_STATUS, "in", NO_WEBSITE_VALUES, 30, "medium", "discovery", 10],
  ["seo", "missing_title", "Başlık etiketi eksik", "Missing title tag", "Sayfa başlığı (title) bulunamadı.", "The page title tag is missing.", SIGNAL_TYPES.WEBSITE_HAS_META_TITLE, "is_false", null, 10, "high", "basic", 20],
  ["seo", "weak_title", "Zayıf başlık etiketi", "Weak title tag", "Sayfa başlığı çok kısa, çok uzun veya genel.", "The page title is too short, too long or generic.", SIGNAL_TYPES.WEBSITE_TITLE_QUALITY, "eq", "weak", 5, "medium", "basic", 25],
  ["seo", "missing_description", "Meta açıklama eksik", "Missing meta description", "Meta açıklama bulunamadı.", "The meta description is missing.", SIGNAL_TYPES.WEBSITE_HAS_META_DESCRIPTION, "is_false", null, 10, "high", "basic", 30],
  ["seo", "missing_schema", "Yapısal veri eksik", "Missing structured data", "schema.org yapısal verisi tespit edilmedi.", "No schema.org structured data was detected.", SIGNAL_TYPES.WEBSITE_HAS_SCHEMA, "is_false", null, 10, "high", "basic", 40],
  ["seo", "missing_sitemap", "Sitemap yok", "No sitemap", "sitemap.xml bulunamadı.", "sitemap.xml was not found.", SIGNAL_TYPES.WEBSITE_HAS_SITEMAP, "is_false", null, 10, "medium", "basic", 50],
  ["seo", "missing_robots", "robots.txt yok", "No robots.txt", "robots.txt bulunamadı.", "robots.txt was not found.", SIGNAL_TYPES.WEBSITE_HAS_ROBOTS, "is_false", null, 5, "medium", "basic", 60],
  ["seo", "missing_h1", "H1 başlığı eksik", "Missing H1", "Sayfada H1 başlığı bulunamadı.", "No H1 heading was found on the page.", SIGNAL_TYPES.WEBSITE_HAS_H1, "is_false", null, 10, "high", "basic", 70],
  ["seo", "missing_canonical", "Canonical etiketi eksik", "Missing canonical", "Canonical etiketi bulunamadı.", "No canonical tag was found.", SIGNAL_TYPES.WEBSITE_HAS_CANONICAL, "is_false", null, 5, "high", "basic", 80],
  ["seo", "poor_mobile_performance", "Zayıf mobil performans", "Poor mobile performance", "Mobil performans skoru düşük.", "The mobile performance score is low.", SIGNAL_TYPES.PERFORMANCE_MOBILE_SCORE, "lt", 50, 20, "low", "deep", 90],
  ["seo", "mid_mobile_performance", "Geliştirilebilir mobil performans", "Mobile performance could improve", "Mobil performans skoru orta düzeyde.", "The mobile performance score is mid-range.", SIGNAL_TYPES.PERFORMANCE_MOBILE_SCORE, "between", [50, 89], 10, "low", "deep", 95],
  ["seo", "missing_language", "Dil etiketi eksik", "Missing language attribute", "HTML dil etiketi tanımlanmamış.", "The HTML language attribute is not declared.", SIGNAL_TYPES.WEBSITE_LANGUAGE_DECLARED, "is_false", null, 5, "high", "basic", 100],
  // Social Media
  ["social_media", "no_instagram", "Instagram profili bulunamadı", "No Instagram profile found", "Kontrol edilen kaynaklarda Instagram profili bulunamadı.", "No Instagram profile was found in the sources checked.", SIGNAL_TYPES.INSTAGRAM_STATUS, "eq", "not_found", 40, "medium", "basic", 10],
  ["social_media", "ambiguous_instagram", "Instagram profili belirsiz", "Instagram profile ambiguous", "Instagram profili net olarak eşleştirilemedi.", "The Instagram profile could not be matched with confidence.", SIGNAL_TYPES.INSTAGRAM_STATUS, "eq", "ambiguous", 10, "low", "basic", 15],
  ["social_media", "inactive_instagram", "Pasif Instagram profili", "Inactive Instagram profile", "Son paylaşım uzun süre önce görünüyor.", "The last visible post appears to be a long time ago.", SIGNAL_TYPES.INSTAGRAM_IS_ACTIVE, "is_false", null, 25, "medium", "basic", 20],
  ["social_media", "no_website_link", "Profilde web sitesi bağlantısı yok", "No website link on profile", "Profilde web sitesi bağlantısı görünmüyor.", "No website link is visible on the profile.", SIGNAL_TYPES.INSTAGRAM_HAS_WEBSITE_LINK, "is_false", null, 10, "medium", "basic", 30],
  ["social_media", "incomplete_bio", "Eksik biyografi", "Incomplete bio", "Profil biyografisi eksik görünüyor.", "The profile bio appears incomplete.", SIGNAL_TYPES.INSTAGRAM_BIO_COMPLETE, "is_false", null, 10, "medium", "basic", 40],
  ["social_media", "no_social_links_on_site", "Web sitesinde sosyal bağlantı yok", "No social links on website", "Web sitesinde sosyal medya bağlantısı tespit edilmedi.", "No social media links were detected on the website.", SIGNAL_TYPES.WEBSITE_HAS_SOCIAL_LINKS, "is_false", null, 15, "high", "basic", 50],
  ["social_media", "few_photos", "Az görsel içerik", "Few photos", "Google profilinde az sayıda fotoğraf var.", "The Google profile has few photos.", SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, "lt", 5, 10, "medium", "discovery", 60],
  // Google Business
  ["google_business", "missing_hours", "Çalışma saatleri eksik", "Missing opening hours", "Profilde çalışma saatleri görünmüyor.", "Opening hours are not shown on the profile.", SIGNAL_TYPES.GOOGLE_HAS_OPENING_HOURS, "is_false", null, 15, "high", "discovery", 10],
  ["google_business", "few_photos", "Az fotoğraf", "Few photos", "Profilde 5'ten az fotoğraf var.", "The profile has fewer than 5 photos.", SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, "lt", 5, 15, "medium", "discovery", 20],
  ["google_business", "missing_phone", "Telefon eksik", "Missing phone", "Profilde telefon numarası görünmüyor.", "No phone number is shown on the profile.", SIGNAL_TYPES.GOOGLE_HAS_PHONE, "is_false", null, 15, "high", "discovery", 30],
  ["google_business", "missing_website", "Web sitesi bağlantısı eksik", "Missing website link", "Profilde web sitesi bağlantısı görünmüyor.", "No website link is shown on the profile.", SIGNAL_TYPES.GOOGLE_HAS_WEBSITE, "is_false", null, 20, "high", "discovery", 40],
  ["google_business", "low_review_count", "Az yorum", "Low review count", "Profilde 10'dan az yorum var.", "The profile has fewer than 10 reviews.", SIGNAL_TYPES.GOOGLE_REVIEW_COUNT, "lt", 10, 15, "high", "discovery", 50],
  ["google_business", "low_rating", "Düşük puan", "Low rating", "Ortalama puan 4.0'ın altında.", "The average rating is below 4.0.", SIGNAL_TYPES.GOOGLE_RATING, "lt", 4.0, 10, "high", "discovery", 60],
  ["google_business", "incomplete_profile", "Eksik profil", "Incomplete profile", "Profil bütünlük skoru düşük.", "The profile completeness score is low.", SIGNAL_TYPES.GOOGLE_COMPLETENESS_SCORE, "lt", 60, 10, "medium", "discovery", 70],
  // Review Management
  ["review_management", "low_response_rate", "Düşük yorum yanıt oranı", "Low review response rate", "Örneklenen yorumların çoğu işletme tarafından yanıtlanmamış.", "Most sampled reviews have no owner response.", SIGNAL_TYPES.GOOGLE_REVIEW_RESPONSE_RATE, "lt", 0.3, 30, "low", "basic", 10],
  ["review_management", "many_reviews", "Çok sayıda yorum", "Many reviews", "Yönetilmesi gereken 50'den fazla yorum var.", "There are more than 50 reviews to manage.", SIGNAL_TYPES.GOOGLE_REVIEW_COUNT, "gte", 50, 10, "high", "discovery", 20],
  ["review_management", "recent_unanswered", "Yanıtsız güncel yorumlar", "Recent unanswered reviews", "Örneklenen güncel yorumlar arasında yanıtsız olanlar var.", "Sampled recent reviews include unanswered ones.", SIGNAL_TYPES.GOOGLE_RECENT_UNANSWERED_REVIEWS, "gte", 2, 20, "low", "basic", 30],
  ["review_management", "mid_rating", "Geliştirilebilir puan", "Rating could improve", "Ortalama puan 3.0 ile 4.2 arasında.", "The average rating is between 3.0 and 4.2.", SIGNAL_TYPES.GOOGLE_RATING, "between", [3.0, 4.2], 20, "high", "discovery", 40],
  ["review_management", "very_low_rating", "Çok düşük puan", "Very low rating", "Ortalama puan 3.0'ın altında.", "The average rating is below 3.0.", SIGNAL_TYPES.GOOGLE_RATING, "lt", 3.0, 25, "high", "discovery", 50],
  ["review_management", "needs_reviews", "Yorum kazanımı gerekli", "Needs review acquisition", "Profilde 10'dan az yorum var.", "The profile has fewer than 10 reviews.", SIGNAL_TYPES.GOOGLE_REVIEW_COUNT, "lt", 10, 15, "high", "discovery", 60],
  // Branding
  ["branding", "no_logo_signal", "Logo sinyali yok", "No logo signal", "Web sitesinde logo veya paylaşım görseli tespit edilmedi.", "No logo or share image was detected on the website.", SIGNAL_TYPES.BRANDING_HAS_LOGO_SIGNAL, "is_false", null, 25, "medium", "basic", 10],
  ["branding", "name_inconsistent", "İsim tutarsızlığı", "Name inconsistency", "Web sitesi başlığı işletme adını içermiyor.", "The website title does not include the business name.", SIGNAL_TYPES.BRANDING_NAME_CONSISTENCY, "is_false", null, 20, "medium", "basic", 20],
  ["branding", "no_favicon", "Favicon yok", "No favicon", "Web sitesinde favicon bulunamadı.", "No favicon was found on the website.", SIGNAL_TYPES.WEBSITE_HAS_FAVICON, "is_false", null, 15, "high", "basic", 30],
  ["branding", "no_open_graph", "Paylaşım görseli yok", "No Open Graph data", "Sosyal paylaşım (Open Graph) etiketleri bulunamadı.", "No Open Graph tags were found.", SIGNAL_TYPES.WEBSITE_HAS_OPEN_GRAPH, "is_false", null, 15, "high", "basic", 40],
  ["branding", "low_consistency", "Düşük marka tutarlılığı", "Low brand consistency", "Sezgisel marka tutarlılık skoru düşük.", "The heuristic brand consistency score is low.", SIGNAL_TYPES.BRANDING_CONSISTENCY_SCORE, "lt", 50, 25, "low", "basic", 50],
  ["branding", "no_web_presence", "Web marka varlığı yok", "No web brand presence", "Web sitesi olmadan marka varlığı sınırlı.", "Brand presence is limited without a website.", SIGNAL_TYPES.WEBSITE_STATUS, "in", NO_WEBSITE_VALUES, 20, "medium", "discovery", 60],
];

export const DEFAULT_RULES: readonly DefaultRuleSeed[] = RULE_TUPLES.map(
  ([serviceKey, key, nameTr, nameEn, explanationTr, explanationEn, signalType, operator, value, points, minConfidence, requiresDepth, sortOrder]) => ({
    serviceKey,
    key,
    nameTr,
    nameEn,
    explanationTr,
    explanationEn,
    signalType,
    operator,
    // Arrays are copied so callers cannot mutate the shared seed constant.
    value: Array.isArray(value) ? [...value] : value,
    points,
    minConfidence,
    requiresDepth,
    active: true,
    sortOrder,
    version: DEFAULT_RULES_VERSION,
  }),
);

/** Deterministic id for a default service that has no database row. */
export function defaultServiceId(serviceKey: string): string {
  return `default:${serviceKey}`;
}

/** Deterministic id for a default rule (never a database id). */
export function defaultRuleId(serviceKey: string, ruleKey: string): string {
  return `default:${serviceKey}:${ruleKey}`;
}

/**
 * Materialises the default services and rules as engine inputs.
 *
 * `serviceKeyToId` maps a service key to its database id so results can be
 * persisted; services without a mapping receive the synthetic id
 * `default:<key>` (offline fallback and tests only, never written to the DB).
 * Rule ids are always synthetic.
 */
export function loadDefaultRules(serviceKeyToId: Record<string, string> = {}): { services: ServiceDefinition[]; rules: ServiceRule[] } {
  const services: ServiceDefinition[] = DEFAULT_SERVICES.map((service) => ({
    ...service,
    id: serviceKeyToId[service.key] ?? defaultServiceId(service.key),
  }));
  const idByKey = new Map(services.map((service) => [service.key, service.id]));

  const rules: ServiceRule[] = [];
  for (const seed of DEFAULT_RULES) {
    const serviceId = idByKey.get(seed.serviceKey);
    if (!serviceId) continue;
    const { serviceKey, ...rest } = seed;
    rules.push({
      ...rest,
      // `value` may be an array or object; deep-copy it so a caller mutating a
      // returned rule cannot corrupt the module-level seed for later calls.
      value: rest.value !== null && typeof rest.value === "object" ? (structuredClone(rest.value) as ServiceRule["value"]) : rest.value,
      id: defaultRuleId(serviceKey, seed.key),
      serviceId,
    });
  }

  return { services, rules };
}
