import type { AnalyzeOpportunityInput, GenerateMessageInput } from "@/types/ai";

/**
 * Fictional, self-consistent inputs used by the AI module tests and available
 * to other modules' tests. Not demo data for the UI (that lives in lib/demo).
 */
export function sampleMessageInput(overrides: Partial<GenerateMessageInput> = {}): GenerateMessageInput {
  return {
    locale: "tr",
    channel: "email",
    tone: "friendly_professional",
    length: "medium",
    serviceKey: "website_development",
    serviceLabel: "Web Sitesi Geliştirme",
    business: {
      businessName: "Kadıköy Kahve Evi",
      categoryLabel: "Kafe",
      district: "Kadıköy",
      city: "İstanbul",
      rating: 4.6,
      reviewCount: 1250,
      websiteStatus: "not_found",
      websiteUrl: null,
      instagramStatus: "not_checked",
      googleGaps: ["Çalışma saatleri eksik"],
      topFindings: [
        {
          key: "google.no_website",
          title: "Google İşletme profilinde web sitesi bağlantısı bulunmuyor",
          explanation: "Profilde bir web sitesi alanı gözlemlenmedi.",
          confidence: "high",
        },
        { key: "google.missing_hours", title: "Çalışma saatleri profilde yer almıyor", confidence: "medium" },
      ],
      serviceScores: [
        { serviceKey: "website_development", serviceLabel: "Web Sitesi Geliştirme", score: 85 },
        { serviceKey: "google_business", serviceLabel: "Google İşletme Optimizasyonu", score: 62 },
      ],
    },
    sender: {
      senderName: "Ayşe Yılmaz",
      senderTitle: "Kurucu",
      workspaceName: "Marmara Dijital",
      companyDescription: "Kadıköy merkezli küçük bir web ajansı",
    },
    offering: {
      name: "Başlangıç Web Sitesi",
      description: "Tek sayfalık, mobil uyumlu tanıtım sitesi",
      priceFrom: 7500,
      priceTo: 12000,
      currency: "TRY",
      billingPeriod: "one_time",
      deliveryTime: "2 hafta",
      promptContext: null,
    },
    templateBody: null,
    templateSubject: null,
    reportLink: "https://app.example.com/report/abc123",
    userInstruction: null,
    ...overrides,
  };
}

export function sampleAnalysisInput(overrides: Partial<AnalyzeOpportunityInput> = {}): AnalyzeOpportunityInput {
  const message = sampleMessageInput();
  return {
    locale: "tr",
    business: message.business,
    services: [
      {
        serviceKey: "website_development",
        serviceLabel: "Web Sitesi Geliştirme",
        score: 85,
        reasons: ["Profilde web sitesi bağlantısı yok", "Yüksek yorum sayısı"],
      },
      {
        serviceKey: "google_business",
        serviceLabel: "Google İşletme Optimizasyonu",
        score: 62,
        reasons: ["Çalışma saatleri eksik"],
      },
    ],
    ...overrides,
  };
}
