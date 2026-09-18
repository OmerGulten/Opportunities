import type { MessageTree } from "../../config";

/**
 * Owned by the audits module (`src/lib/audits/**`).
 *
 * Three trees live here:
 *  - `<finding_key>.{title,explanation,why}` for human findings,
 *  - `signal.<signal_type_with_underscores>` for signal explanations,
 *  - `unavailable.<reason>` for signals that could not be established.
 *
 * Keys use underscores because the translator splits lookups on dots. `tr` and
 * `en` must stay key-identical (enforced by src/lib/audits/i18n.test.ts).
 */
export const findings: MessageTree = {
  // -------------------------------------------------------------------------
  // Website
  // -------------------------------------------------------------------------
  website_not_found: {
    title: "Web sitesi bulunamadı",
    explanation: "İşletme profilinde web sitesi bağlantısı yer almıyor.",
    why: "Web sitesi, işletmenin içeriğini tümüyle kendisinin belirlediği tek kanaldır.",
  },
  website_unreachable: {
    title: "Web sitesine ulaşılamadı",
    explanation: "{{url}} adresi denetim sırasında yanıt vermedi. Site yayında olabilir; bu yalnızca bu denemeye ait bir gözlemdir.",
    why: "Aynı anda ziyaretçiler de erişememiş olabilir; erişilebilirlik izlenmeye değer.",
  },
  website_invalid: {
    title: "Web sitesi adresi kullanılamadı",
    explanation: "{{url}} adresi geçerli bir genel web adresi olarak çözümlenemedi.",
    why: "Profildeki hatalı adres, ziyaretçiyi açılmayan bir sayfaya götürür.",
  },
  website_redirected: {
    title: "Adres başka bir alan adına yönlendi",
    explanation: "İstek {{finalUrl}} adresine yönlendirildi.",
    why: "Yönlendirme zinciri, markanın hangi alan adında yayınlandığını gösterir.",
  },
  website_no_https: {
    title: "HTTPS kullanılmıyor",
    explanation: "Site güvenli bağlantı (HTTPS) olmadan sunuluyor.",
    why: "Tarayıcılar HTTPS olmayan sayfaları 'güvenli değil' olarak işaretler.",
  },
  website_missing_title: {
    title: "Sayfa başlığı yok",
    explanation: "Ana sayfada title etiketi bulunamadı.",
    why: "Başlık, arama sonuçlarında görünen ilk satırdır.",
  },
  website_weak_title: {
    title: "Sayfa başlığı geliştirilebilir",
    explanation: "Başlık {{length}} karakter; genel bir ifade veya önerilen uzunluk aralığının dışında.",
    why: "15-70 karakter arası, işletmeyi ve hizmeti içeren başlıklar arama sonuçlarında daha anlaşılırdır.",
  },
  website_missing_meta_description: {
    title: "Meta açıklama yok",
    explanation: "Sayfada meta description etiketi bulunamadı.",
    why: "Açıklama, arama sonucunda başlığın altında görünen metni belirler.",
  },
  website_weak_meta_description: {
    title: "Meta açıklama geliştirilebilir",
    explanation: "Açıklama {{length}} karakter; önerilen aralık 50-160 karakter.",
    why: "Çok kısa veya çok uzun açıklamalar arama sonuçlarında kırpılır.",
  },
  website_missing_h1: {
    title: "H1 başlığı yok",
    explanation: "Sayfada H1 başlığı bulunamadı.",
    why: "H1, sayfanın ana konusunu hem ziyaretçiye hem arama motoruna bildirir.",
  },
  website_heading_structure: {
    title: "Başlık yapısı dağınık",
    explanation: "Sayfada {{h1}} adet H1 ve {{h2}} adet H2 başlık var.",
    why: "Tek bir H1 ve onu izleyen H2 başlıkları sayfanın okunmasını kolaylaştırır.",
  },
  website_missing_viewport: {
    title: "Viewport etiketi yok",
    explanation: "Mobil görünüm için viewport meta etiketi bulunamadı.",
    why: "Bu etiket olmadan sayfa mobil ekranda masaüstü genişliğinde açılır.",
  },
  website_missing_canonical: {
    title: "Canonical etiketi yok",
    explanation: "Sayfada canonical bağlantısı bulunamadı.",
    why: "Canonical, aynı içeriğin farklı adreslerde tekrarlanmasını önler.",
  },
  website_missing_schema: {
    title: "Yapısal veri yok",
    explanation: "Sayfada schema.org yapısal verisi bulunamadı.",
    why: "Yapısal veri; adres, çalışma saati ve puan bilgisinin arama sonuçlarında gösterilmesini sağlar.",
  },
  website_missing_open_graph: {
    title: "Paylaşım etiketleri yok",
    explanation: "Sayfada Open Graph etiketleri bulunamadı.",
    why: "Bu etiketler olmadan bağlantı paylaşımlarında görsel ve başlık oluşmaz.",
  },
  website_missing_favicon: {
    title: "Favicon yok",
    explanation: "Sayfada favicon bağlantısı tanımlanmamış.",
    why: "Favicon, sekmelerde ve yer imlerinde markayı görünür kılar.",
  },
  website_missing_robots: {
    title: "robots.txt bulunamadı",
    explanation: "Alan adının kökünde robots.txt dosyası bulunamadı.",
    why: "robots.txt, arama motoru taramasını yönlendirir.",
  },
  website_missing_sitemap: {
    title: "Site haritası bulunamadı",
    explanation: "sitemap.xml bulunamadı ve robots.txt içinde site haritası bildirilmedi.",
    why: "Site haritası, sayfaların taranmasını hızlandırır.",
  },
  website_low_alt_coverage: {
    title: "Görsellerde alt metni eksik",
    explanation: "{{total}} görselin {{withAlt}} tanesinde alt metni var.",
    why: "Alt metni, ekran okuyucular ve görsel arama için görselin içeriğini tanımlar.",
  },
  website_missing_cta: {
    title: "Görünür eylem çağrısı yok",
    explanation: "Bağlantı ve düğme metinlerinde arama, randevu, rezervasyon veya iletişim çağrısı tespit edilmedi.",
    why: "Eylem çağrısı, ziyaretçinin sayfada ne yapacağını belirler.",
  },
  website_missing_contact_info: {
    title: "İletişim bilgisi bulunamadı",
    explanation: "Sayfada telefon, e-posta veya adres bilgisi tespit edilmedi.",
    why: "İletişim bilgisi olmayan sayfa, karar vermiş ziyaretçiyi aramaya devam etmeye bırakır.",
  },
  website_missing_booking: {
    title: "Online randevu veya rezervasyon akışı yok",
    explanation: "Sayfada randevu, rezervasyon veya online sipariş akışı tespit edilmedi.",
    why: "Online akış, mesai dışında da talep toplanmasını sağlar.",
  },
  website_missing_social_links: {
    title: "Sosyal medya bağlantısı yok",
    explanation: "Sayfada sosyal medya profiline bağlantı tespit edilmedi.",
    why: "Bağlantılar, siteyi ziyaret eden kişiyi düzenli içerik paylaşılan kanala taşır.",
  },
  website_not_mobile_friendly: {
    title: "Mobil uyum zayıf görünüyor",
    explanation: "Değerlendirme viewport etiketi ve sabit genişlikli düzen üzerinden sezgisel olarak yapıldı; gerçek cihaz testi çalıştırılmadı.",
    why: "Yerel aramaların büyük bölümü mobil cihazlardan geliyor.",
  },
  website_slow_response: {
    title: "Sunucu yanıtı yavaş",
    explanation: "Ana sayfa {{ms}} ms içinde yanıt verdi.",
    why: "Yanıt süresi, sayfanın açılma hızının ilk bileşenidir.",
  },
  website_thin_content: {
    title: "Sayfa içeriği az",
    explanation: "Ana sayfada {{count}} kelimelik metin tespit edildi.",
    why: "Hizmetleri açıklayan metin, hem ziyaretçi hem arama motoru için bağlam sağlar.",
  },
  website_missing_language: {
    title: "Dil etiketi yok",
    explanation: "html etiketinde lang tanımı bulunamadı.",
    why: "Dil etiketi, tarayıcı çevirisi ve erişilebilirlik için içeriğin dilini bildirir.",
  },
  website_broken_links: {
    title: "Yanıt vermeyen bağlantılar",
    explanation: "Örneklenen {{checked}} iç bağlantıdan {{broken}} tanesi hata döndürdü.",
    why: "Kırık bağlantılar ziyaretçiyi boş bir sayfada bırakır.",
  },
  website_quality_weak: {
    title: "Web sitesi kalite skoru düşük",
    explanation: "Gözlemlenen sinyallerden hesaplanan kalite skoru {{score}}/100.",
    why: "Skor; teknik, SEO ve kullanıcı deneyimi gözlemlerinin birleşimidir.",
  },

  // -------------------------------------------------------------------------
  // Google Business Profile
  // -------------------------------------------------------------------------
  google_missing_hours: {
    title: "Çalışma saatleri görünmüyor",
    explanation: "Google profilinde çalışma saati bilgisi bulunamadı.",
    why: "Saat bilgisi olmayan profil, 'şu an açık mı?' sorusuna yanıt veremez.",
  },
  google_few_photos: {
    title: "Profilde az fotoğraf var",
    explanation: "Profilde {{count}} fotoğraf görünüyor; karşılaştırma için kullanılan alt sınır {{target}}. Sağlayıcı en fazla {{cap}} fotoğraf döndürür.",
    why: "Fotoğraflar, profilin tıklanma ve yol tarifi oranını etkiler.",
  },
  google_missing_phone: {
    title: "Telefon numarası görünmüyor",
    explanation: "Google profilinde telefon numarası bulunamadı.",
    why: "Telefon, yerel aramalarda en sık kullanılan iletişim yoludur.",
  },
  google_missing_website: {
    title: "Web sitesi bağlantısı görünmüyor",
    explanation: "Google profilinde web sitesi bağlantısı bulunamadı.",
    why: "Bağlantı, profili görüntüleyen kişiyi işletmenin kendi kanalına taşır.",
  },
  google_low_review_count: {
    title: "Yorum sayısı az",
    explanation: "Profilde {{count}} yorum var; karşılaştırma için kullanılan alt sınır {{target}}.",
    why: "Yorum sayısı, yerel sıralama ve güven açısından belirleyicidir.",
  },
  google_low_rating: {
    title: "Puan ortalaması düşük",
    explanation: "Profilin puanı {{rating}}; karşılaştırma için kullanılan alt sınır {{target}}.",
    why: "Puan, arama sonuçlarında tıklama kararını doğrudan etkiler.",
  },
  google_incomplete_profile: {
    title: "Profil bilgileri eksik",
    explanation: "Gözlemlenen alanlardan hesaplanan profil bütünlük skoru {{score}}/100.",
    why: "Eksik alanlar, profilin yerel aramalarda görünürlüğünü sınırlar.",
  },
  google_review_responses_unavailable: {
    title: "Yorum yanıtları görüntülenemiyor",
    explanation: "Kullanılan sağlayıcı yorum yanıtlarını paylaşmıyor; yanıt oranı ölçülemedi.",
    why: "Ölçülemeyen alan puanlamaya dahil edilmez.",
  },
  google_low_response_rate: {
    title: "Yorum yanıt oranı düşük görünüyor",
    explanation: "Örneklenen {{size}} yorumun %{{rate}} kadarında işletme yanıtı görüldü. Örneklem küçük olduğu için bu gözlem düşük güvenilirliktedir.",
    why: "Yanıtlanan yorumlar, yeni müşterilere işletmenin ilgilendiğini gösterir.",
  },
  google_not_operational: {
    title: "Profil durumu faal görünmüyor",
    explanation: "Google profilinde işletme durumu {{status}} olarak görünüyor.",
    why: "Durum bilgisi, iletişime geçmeden önce doğrulanmalıdır.",
  },

  // -------------------------------------------------------------------------
  // Instagram
  // -------------------------------------------------------------------------
  instagram_not_found: {
    title: "Instagram profili bulunamadı",
    explanation: "Kontrol edilen kaynaklarda (işletme profili verisi ve web sitesi bağlantıları) Instagram profili bulunamadı.",
    why: "Profil başka bir adla mevcut olabilir; bulgu yalnızca kontrol edilen kaynakları kapsar.",
  },
  instagram_ambiguous: {
    title: "Instagram profili belirsiz",
    explanation: "Web sitesinde birden fazla Instagram kullanıcı adı görüldü; hangisinin işletmeye ait olduğu belirlenemedi.",
    why: "Eşleştirme netleşmeden bu alan puanlamaya dahil edilmez.",
  },
  instagram_not_checked: {
    title: "Instagram kontrol edilmedi",
    explanation: "Bu tarama derinliğinde veya bu ayarlarla Instagram araştırması çalıştırılmadı.",
    why: "Kontrol edilmeyen bir alan 'yok' olarak raporlanmaz.",
  },
  instagram_activity_unavailable: {
    title: "Instagram etkinliği ölçülmedi",
    explanation: "Profil içeriği (paylaşım sıklığı, takipçi sayısı, biyografi) bu sürümde okunmuyor.",
    why: "Yalnızca gözlemlenen veriler raporlanır.",
  },

  // -------------------------------------------------------------------------
  // Performance
  // -------------------------------------------------------------------------
  performance_poor_mobile: {
    title: "Mobil performans düşük",
    explanation: "Mobil performans skoru {{score}}/100 ({{method}}).",
    why: "Yavaş açılan sayfalar, ziyaretçilerin bir bölümünü sayfa açılmadan kaybeder.",
  },
  performance_needs_improvement: {
    title: "Mobil performans geliştirilebilir",
    explanation: "Mobil performans skoru {{score}}/100 ({{method}}).",
    why: "Skorun yükselmesi, ilk açılış deneyimini doğrudan iyileştirir.",
  },

  // -------------------------------------------------------------------------
  // Branding
  // -------------------------------------------------------------------------
  branding_missing_logo: {
    title: "Logo sinyali bulunamadı",
    explanation: "Sayfada logo görseli veya paylaşım görseli tespit edilmedi.",
    why: "Logo, markayı tanıtan ilk görsel öğedir.",
  },
  branding_name_inconsistent: {
    title: "İşletme adı sayfada eşleşmiyor",
    explanation: "Sayfa başlığında ve ana başlıkta işletme adı tanınamadı.",
    why: "Aynı adın her kanalda geçmesi, arama sonuçlarında eşleşmeyi kolaylaştırır.",
  },
  branding_low_consistency: {
    title: "Marka tutarlılığı düşük",
    explanation: "Logo, favicon, paylaşım etiketleri ve isim eşleşmesinden hesaplanan sezgisel skor {{score}}/100.",
    why: "Tutarlı görsel kimlik, farklı kanallardaki temasların aynı markaya ait olduğunu gösterir.",
  },

  // -------------------------------------------------------------------------
  // Signal explanations
  // -------------------------------------------------------------------------
  signal: {
    website_status: "Web sitesi durumu: {{value}}.",
    website_url: "Denetlenen web adresi: {{value}}.",
    website_quality: "Gözlemlerden türetilen web sitesi kalitesi: {{value}}.",
    website_quality_score: "Web sitesi kalite skoru: {{value}}/100.",
    website_https: "Güvenli bağlantı (HTTPS): {{value}}.",
    website_response_time_ms: "Ana sayfa yanıt süresi: {{value}} ms.",
    website_status_code: "HTTP durum kodu: {{value}}.",
    website_has_meta_title: "Sayfa başlığı (title) var mı: {{value}}.",
    website_title_quality: "Başlık değerlendirmesi: {{value}} ({{length}} karakter).",
    website_has_meta_description: "Meta açıklama var mı: {{value}}.",
    website_description_quality: "Meta açıklama değerlendirmesi: {{value}} ({{length}} karakter).",
    website_has_h1: "H1 başlığı var mı: {{value}} ({{count}} adet).",
    website_heading_structure_ok: "Başlık yapısı uygun mu: {{value}} (H1: {{h1}}, H2: {{h2}}).",
    website_has_viewport: "Viewport etiketi var mı: {{value}}.",
    website_has_canonical: "Canonical etiketi var mı: {{value}}.",
    website_has_schema: "Yapısal veri var mı: {{value}} ({{types}}).",
    website_has_open_graph: "Open Graph etiketleri var mı: {{value}}.",
    website_has_favicon: "Favicon var mı: {{value}}.",
    website_has_sitemap: "sitemap.xml bulundu mu: {{value}}.",
    website_has_robots: "robots.txt bulundu mu: {{value}}.",
    website_image_alt_coverage: "Alt metni oranı: {{value}} ({{total}} görselin {{withAlt}} tanesinde alt metni var).",
    website_has_cta: "Eylem çağrısı tespit edildi mi: {{value}} ({{samples}}).",
    website_has_contact_info: "İletişim bilgisi tespit edildi mi: {{value}}.",
    website_has_phone: "Sayfada telefon numarası tespit edildi mi: {{value}}.",
    website_has_address: "Sayfada adres tespit edildi mi: {{value}}.",
    website_has_opening_hours: "Sayfada çalışma saati tespit edildi mi: {{value}}.",
    website_has_booking: "Randevu veya rezervasyon akışı tespit edildi mi: {{value}}.",
    website_has_menu: "Menü sayfası tespit edildi mi: {{value}}.",
    website_has_whatsapp: "WhatsApp bağlantısı tespit edildi mi: {{value}}.",
    website_has_social_links: "Sosyal medya bağlantısı var mı: {{value}} ({{count}} bağlantı).",
    website_mobile_friendly: "Mobil uyum sezgisel değerlendirmesi: {{value}}.",
    website_language_declared: "HTML dil etiketi tanımlı mı: {{value}} ({{lang}}).",
    website_broken_links_count: "Yanıt vermeyen bağlantı sayısı: {{value}} ({{checked}} bağlantı kontrol edildi).",
    performance_mobile_score: "Mobil performans skoru: {{value}} ({{method}}).",
    performance_desktop_score: "Masaüstü performans skoru: {{value}} ({{method}}).",
    performance_lcp_ms: "En büyük içerik boyaması (LCP): {{value}} ms ({{method}}).",
    performance_cls: "Düzen kayması (CLS): {{value}} ({{method}}).",
    performance_inp_ms: "Etkileşim gecikmesi (INP): {{value}} ms ({{method}}).",
    performance_mobile_grade: "Mobil performans sınıfı: {{value}} ({{method}}).",
    instagram_status: "Instagram durumu: {{value}}.",
    instagram_profile_url: "Instagram profil adresi: {{value}}.",
    instagram_days_since_last_post: "Son paylaşımdan bu yana geçen gün: {{value}}.",
    instagram_is_active: "Profil etkin mi: {{value}}.",
    instagram_has_website_link: "Profilde web sitesi bağlantısı var mı: {{value}}.",
    instagram_bio_complete: "Profil biyografisi tam mı: {{value}}.",
    instagram_follower_count: "Takipçi sayısı: {{value}}.",
    google_rating: "Google puanı: {{value}}.",
    google_review_count: "Google yorum sayısı: {{value}}.",
    google_has_opening_hours: "Profilde çalışma saati var mı: {{value}}.",
    google_photo_count: "Profildeki fotoğraf sayısı: {{value}} (sağlayıcı en fazla {{cap}} fotoğraf döndürür).",
    google_has_website: "Profilde web sitesi bağlantısı var mı: {{value}}.",
    google_has_phone: "Profilde telefon numarası var mı: {{value}}.",
    google_business_status: "Google işletme durumu: {{value}}.",
    google_profile_completeness: "Profil bütünlüğü: {{value}}.",
    google_completeness_score: "Profil bütünlük skoru: {{value}}/100.",
    google_review_response_rate: "Örneklenen {{size}} yorumun {{withReply}} tanesinde işletme yanıtı görüldü; oran {{value}}.",
    google_recent_unanswered_reviews: "Son {{days}} günde yanıtsız görünen yorum sayısı: {{value}} ({{size}} yorumluk örneklem).",
    google_review_sample_size: "İncelenen yorum örneklemi: {{value}} yorum.",
    branding_has_logo_signal: "Logo sinyali tespit edildi mi: {{value}}.",
    branding_name_consistency: "İşletme adı sayfada eşleşiyor mu: {{value}}.",
    branding_consistency_score: "Marka tutarlılığı sezgisel skoru: {{value}}/100.",
  },

  // -------------------------------------------------------------------------
  // Why a signal could not be established
  // -------------------------------------------------------------------------
  unavailable: {
    website_not_found: "İşletmenin web sitesi bulunmadığı için bu kontrol yapılmadı.",
    website_not_reachable: "Web sitesine ulaşılamadığı için bu kontrol yapılamadı.",
    website_invalid: "Web adresi kullanılamadığı için bu kontrol yapılamadı.",
    website_not_audited: "Web sitesi denetlenmediği için bu kontrol yapılmadı.",
    website_discovery_depth: "Keşif derinliğinde web sitesi açılmadığı için bu kontrol yapılmadı.",
    robots_not_checked: "Bu taramada robots.txt ve site haritası kontrol edilmedi.",
    broken_links_not_checked: "Bu taramada bağlantı kontrolü yapılmadı.",
    google_field_not_requested: "Bu alan sağlayıcıdan istenmediği için bilinmiyor.",
    google_no_owner_replies: "Sağlayıcı yorum yanıtlarını paylaşmıyor.",
    instagram_not_fetched: "Instagram profili açılmadığı için bu bilgi okunmadı.",
    instagram_not_checked: "Instagram profili belirlenemediği için bu bilgi okunmadı.",
    performance_not_run: "Performans ölçümü bu taramada çalıştırılmadı.",
    performance_no_website: "Denetlenebilir bir web sitesi olmadığı için performans ölçülmedi.",
    performance_metric_unavailable: "Bu metrik {{source}} kaynağında yer almıyor.",
    audit_failed: "Denetim hata verdiği için bu bilgi elde edilemedi.",
  },

  // -------------------------------------------------------------------------
  // Shared words
  // -------------------------------------------------------------------------
  value: {
    yes: "evet",
    no: "hayır",
    unknown: "bilinmiyor",
    weak: "zayıf",
    average: "orta",
    strong: "güçlü",
  },
  method: {
    heuristic: "sezgisel tahmin, Lighthouse ölçümü değil",
    measured: "PageSpeed ölçümü",
  },
  note: {
    instagram_from_provider: "Profil, işletme sağlayıcısının verisinden alındı.",
    instagram_from_website: "Profil bağlantısı web sitesinde bulundu.",
    instagram_handle_matches_name: "Profil bağlantısı web sitesinde bulundu ve kullanıcı adı işletme adıyla örtüşüyor.",
    instagram_multiple_candidates: "Web sitesinde birden fazla kullanıcı adı görüldü: {{candidates}}.",
    instagram_website_not_audited: "Web sitesi denetlenmediği için Instagram araştırması yapılamadı.",
    instagram_other_socials_only: "Web sitesinde başka sosyal medya bağlantıları var, Instagram bağlantısı yok.",
    instagram_no_socials: "Web sitesinde hiçbir sosyal medya bağlantısı bulunamadı.",
    instagram_profile_not_fetched: "Instagram profili açılmadı; paylaşım, takipçi ve biyografi bilgileri okunmadı.",
  },
  benchmark: {
    competitor_label: "Rakip {{letter}}",
    has_website: "Karşılaştırılan {{total}} işletmeden {{count}} tanesinin profilinde web sitesi bağlantısı var. Mevcut işletme: {{current}}.",
    has_instagram: "Karşılaştırılan {{total}} işletmeden {{count}} tanesi için Instagram profili bulundu. Mevcut işletme: {{current}}.",
    has_opening_hours: "Karşılaştırılan {{total}} işletmeden {{count}} tanesinin profilinde çalışma saati var. Mevcut işletme: {{current}}.",
    rating: "Mevcut işletmenin puanı: {{current}}. Karşılaştırılan {{total}} işletmenin puan aralığı {{min}}-{{max}}, ortancası {{median}}.",
    review_count: "Mevcut işletmenin yorum sayısı: {{current}}. Karşılaştırılan {{total}} işletmenin yorum aralığı {{min}}-{{max}}, ortancası {{median}}.",
    photo_count: "Mevcut işletmenin fotoğraf sayısı: {{current}}. Karşılaştırılan {{total}} işletmenin fotoğraf aralığı {{min}}-{{max}}, ortancası {{median}}.",
    website_quality: "Karşılaştırılan {{total}} işletmenin web sitesi kalitesi: {{weak}} zayıf, {{average}} orta, {{strong}} güçlü. Mevcut işletme: {{current}}.",
  },
};
