import type { MessageTree } from "../../config";

/**
 * Owned by the reports feature.
 *
 * `snapshot.*` is read by src/features/reports/service.ts while the snapshot is
 * frozen, so those sentences end up stored inside the report itself.
 * `public.*` is rendered live by /report/[token]. Keep tr and en in sync.
 */
export const reports: MessageTree = {
  snapshot: {
    headline:
      "Bu rapor, {{business}} işletmesinin herkese açık dijital varlığı üzerinde yapılan gözlemleri özetler ve {{count}} bulgu içerir.",
    ctaHeading: "Bulguları birlikte ele alalım",
    ctaBody:
      "{{workspace}} ekibi, raporda listelenen gözlemleri önceliklendirmek ve sonraki adımları planlamak için görüşmeye hazır.",
    disclaimer:
      "Bu rapor, hazırlandığı tarihte herkese açık kaynaklardan otomatik olarak toplanan gözlemlere dayanır. Kontrol edilemeyen maddeler açıkça \"kontrol edilmedi\" olarak işaretlenmiştir; bu, ilgili özelliğin bulunmadığı anlamına gelmez. İçerik bilgilendirme amaçlıdır, zaman içinde değişebilir ve herhangi bir sonuç garantisi vermez.",
  },

  public: {
    documentTitle: "Dijital varlık raporu",
    metaDescription: "Herkese açık kaynaklardan derlenen, bağlantıyla paylaşılan dijital varlık raporu.",
    preparedBy: "Hazırlayan: {{workspace}}",
    generatedAt: "Rapor tarihi: {{date}}",
    print: "Yazdır veya PDF olarak kaydet",
    printHint: "Bu sayfa yazdırmaya uygundur.",

    business: {
      title: "İşletme",
      category: "Kategori",
      location: "Konum",
      address: "Adres",
      rating: "Puan",
      reviews: "Yorum sayısı",
      ratingValue: "{{rating}} / 5",
      website: "Web sitesi",
      instagram: "Instagram",
      maps: "Harita kaydı",
      openMaps: "Harita kaydını aç",
      openWebsite: "Siteyi aç",
      unknown: "Belirtilmemiş",
    },

    summary: {
      title: "Fırsat özeti",
      description: "Puan, aşağıdaki bulgulardan hesaplanır ve satın alma olasılığı değil, gözlemlenen boşlukların yoğunluğunu gösterir.",
      scoreCaption: "Genel",
      notScored: "Puanlanmadı",
      notScoredHint: "Bu işletme için henüz bir genel puan hesaplanmadı.",
      primaryService: "Öne çıkan hizmet alanı",
      confidence: "Genel güven",
      gapsTitle: "Gözlemlenen dijital boşluklar",
      gapsEmpty: "Gözlemlenen bir dijital boşluk kaydedilmedi.",
    },

    findings: {
      title: "Bulgular",
      description: "Her bulgu, nasıl elde edildiğini gösteren kanıt türü ve güven düzeyiyle birlikte listelenir.",
      whyItMatters: "Neden önemli",
      empty: "Bu raporda listelenen bir bulgu yok.",
      emptyHint: "Raporun hazırlandığı anda paylaşılabilir bir bulgu kaydı bulunmuyordu.",
    },

    services: {
      title: "Hizmet bazlı fırsat puanları",
      description: "Her puanın hangi gözlemlerden oluştuğu ve hangi kontrollerin yapılamadığı aşağıda açıkça belirtilmiştir.",
      reasons: "Puana katkı veren gözlemler",
      reasonPoints: "+{{points}}",
      noReasons: "Bu hizmet için puana katkı veren bir gözlem kaydedilmedi.",
      notChecked: "Yapılamayan kontroller",
      notCheckedHint: "Bu maddeler kontrol edilemedi. Eksik oldukları anlamına gelmez ve puana dâhil edilmemiştir.",
      empty: "Hizmet bazlı puan hesaplanmadı.",
    },

    recommendations: {
      title: "Önerilen çalışmalar",
      description: "Bulgulara karşılık gelen hizmet paketleri ve fiyat aralıkları.",
      priceRange: "{{from}} – {{to}}",
      priceFrom: "{{from}} başlangıç fiyatı",
      priceTo: "{{to}} üst sınır",
      priceUnknown: "Fiyat görüşmeye bağlı",
      delivery: "Teslim süresi: {{time}}",
      billing: {
        one_time: "Tek seferlik",
        monthly: "Aylık",
        yearly: "Yıllık",
      },
      empty: "Bu rapora eklenmiş bir hizmet önerisi yok.",
    },

    contact: {
      title: "İletişim",
      email: "E-posta",
      phone: "Telefon",
      website: "Web sitesi",
    },

    disclaimerTitle: "Bu rapor hakkında",
    attributionTitle: "Veri kaynağı",

    states: {
      notFoundTitle: "Rapor bulunamadı",
      notFoundDescription: "Bu bağlantı geçerli bir rapora karşılık gelmiyor. Adresi gönderen kişiyle doğrulayabilirsiniz.",
      inactiveTitle: "Bu bağlantı artık etkin değil",
      inactiveDescription:
        "Rapor bağlantısı kapatıldı veya süresi doldu. Güncel bir rapora ihtiyacınız varsa bağlantıyı paylaşan kişiye ulaşabilirsiniz.",
      errorTitle: "Rapor görüntülenemedi",
      errorDescription: "Rapor yüklenirken beklenmeyen bir sorun oluştu. Sayfayı yeniden deneyebilirsiniz.",
      retry: "Tekrar dene",
    },
  },

  gaps: {
    no_website: "Web sitesi bulunamadı",
    weak_website: "Web sitesi içeriği zayıf",
    no_https: "Güvenli bağlantı (HTTPS) yok",
    no_instagram: "Instagram hesabı bulunamadı",
    inactive_instagram: "Instagram hesabı uzun süredir güncellenmemiş",
    google_incomplete: "Harita profili eksik",
    low_reviews: "Az sayıda yorum",
    low_rating: "Düşük puan ortalaması",
    missing_hours: "Çalışma saatleri girilmemiş",
    few_photos: "Az sayıda fotoğraf",
    slow_mobile: "Mobilde yavaş açılıyor",
    unanswered_reviews: "Yanıtlanmamış yorumlar",
  },
};
