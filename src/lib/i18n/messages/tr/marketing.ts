import type { MessageTree } from "../../config";

/** Owned by the public marketing pages (landing + shared header/footer). */
export const marketing: MessageTree = {
  nav: {
    howItWorks: "Nasıl çalışır",
    scoring: "Puanlama",
    principles: "İlkeler",
    pricing: "Planlar",
  },
  hero: {
    eyebrow: "Yerel işletme fırsat motoru",
    title: "Sattığınız hizmete uyan işletmeleri bulun",
    titleAccent: "gözlemlenebilir kanıtla",
    subtitle:
      "OpportunityOS bir bölgedeki yerel işletmeleri keşfeder, dijital varlıklarını denetler ve her hizmetiniz için ayrı, gerekçeli bir fırsat puanı üretir. Sonra ulaşmanız için gerçeklere bağlı bir mesaj taslağı hazırlar.",
    ctaPrimary: "Ücretsiz başlayın",
    ctaSecondary: "Nasıl çalıştığını görün",
    ctaDashboard: "Panele git",
    note: "Ücretsiz plan ile başlayın. Kredi kartı gerekmez.",
    highlights: {
      h1: "Alan seçimi: yer, yarıçap veya çizilen poligon",
      h2: "Hizmete özel puanlama, kural kural açıklanır",
      h3: "Mesajlar taslak kalır; gönderimi siz yaparsınız",
    },
  },
  loop: {
    title: "Tek bir akış: keşfet, denetle, fırsatı gör, ulaş, takip et",
    description: "Her adım bir sonrakine kanıt taşır. Hiçbir adım tahmin üretmez.",
    steps: {
      s1: { title: "Keşfet", description: "Harita sağlayıcısından bir bölge ve kategori seçerek işletmeleri listeleyin; kopyalar birleştirilir." },
      s2: { title: "Denetle", description: "Google İşletme Profili, web sitesi ve sosyal medya varlığı açık durum kodlarıyla incelenir." },
      s3: { title: "Fırsatı gör", description: "Sinyaller hizmet kurallarıyla eşleşir; her hizmet için ayrı, açıklanabilir bir puan çıkar." },
      s4: { title: "Ulaş", description: "Yalnızca doğrulanmış gerçeklere dayanan WhatsApp, e-posta veya Instagram taslakları üretilir." },
      s5: { title: "Takip et", description: "Yeni, İletişim kuruldu, Yanıt verdi, Görüşme, Teklif, Kazanıldı, Kaybedildi aşamalarıyla ilerleyin." },
    },
  },
  scoring: {
    title: "Tek bir “kalite puanı” değil; her hizmet için ayrı puan",
    description:
      "Bir işletme “web sitesi var / yok” değildir. Sattığınız her hizmet için bağımsız bir fırsat puanı, eşleşen kurallar ve kanıt türleriyle birlikte gösterilir. Böylece hangi teklifle yaklaşacağınızı bilirsiniz.",
    bullets: {
      b1: "Her puan, eşleşen kuralların normalize edilmiş toplamıdır.",
      b2: "Her kural hangi sinyalden geldiğini ve kaç puan eklediğini söyler.",
      b3: "Kontrol edilemeyen alanlar “kontrol edilmedi” olarak kalır, sıfır sayılmaz.",
    },
    example: {
      label: "Örnek görünüm",
      businessName: "Örnek Kuaför & Güzellik",
      businessMeta: "Kadıköy, İstanbul · Kuaför",
      primaryLabel: "Birincil fırsat",
      secondaryLabel: "Diğer hizmetler",
      evidenceTitle: "Bu puanı oluşturan gözlemler",
      e1: "İşletme profilinde web sitesi bağlantısı bulunamadı",
      e2: "Son 12 ayda yanıtlanmamış yorumlar görüldü",
      e3: "Instagram hesabı tespit edilemedi",
      disclaimer: "Bu kart kurgusal bir örnektir; gerçek bir işletmeyi temsil etmez.",
      services: {
        website_development: "Web Sitesi Geliştirme",
        review_management: "Yorum Yönetimi",
        social_media: "Sosyal Medya Yönetimi",
        seo: "SEO",
      },
    },
  },
  honesty: {
    title: "Veri dürüstlüğü ürünün kendisidir",
    description: "Satış konuşmanız ancak dayandığı veri kadar sağlamdır. Bu yüzden ürün asla bilgi uydurmaz.",
    items: {
      i1: { title: "Açık durumlar", description: "Bulundu, bulunamadı, kontrol edilmedi, erişilemedi, hata ve belirsiz ayrı ayrı gösterilir. “Kontrol edilmedi” asla “bulunamadı” gibi sunulmaz." },
      i2: { title: "Kanıt türü etiketli", description: "Her bulgu gözlemlendi, türetildi, sezgisel veya erişilemedi olarak işaretlenir. Sezgisel ölçümler açıkça söylenir." },
      i3: { title: "Tahmin yok", description: "Satın alma olasılığı veya kapanma skoru üretilmez. Yalnızca gözlemlenebilir eksikler raporlanır." },
      i4: { title: "Kapsam sınırı bildirilir", description: "Sağlayıcı sonuçları bölgedeki tüm işletmelerin eksiksiz bir listesi değildir ve arayüz bunu söyler." },
    },
  },
  pricing: {
    title: "Kullanımınıza göre kredi",
    description: "Taramalar ve yapay zeka taslakları kredi harcar. Her plan aylık kredi içerir.",
    perMonth: "/ay",
    creditsPerMonth: "Aylık {{count}} kredi",
    membersIncluded: "{{count}} kullanıcı",
    free: "Ücretsiz",
    cta: "Bu planla başlayın",
    unavailable: "Plan listesi şu anda gösterilemiyor. Ücretsiz plan ile hesap oluşturup güncel planları uygulama içinde görebilirsiniz.",
    note: "Ödeme entegrasyonu bu sürümde devre dışıdır; planlar uygulama içinde yönetilir.",
  },
  cta: {
    title: "Bölgenizdeki ilk taramanızı bugün çalıştırın",
    description: "Hesap oluşturun, hizmetlerinizi seçin ve ilk fırsat listenizi görün.",
    primary: "Ücretsiz hesap oluştur",
    secondary: "Giriş yap",
  },
  footer: {
    tagline: "Yerel işletmelerin gözlemlenebilir dijital eksiklerini sattığınız hizmetle eşleştirin.",
    product: "Ürün",
    legalTitle: "Yasal",
    attribution: "Harita ve işletme verileri Google Maps Platform üzerinden alınır ve sağlayıcı koşullarına göre gösterilir.",
    copyright: "© {{year}} OpportunityOS",
  },
  cookies: {
    title: "Çerezler hakkında",
    description: "Bu uygulama yalnızca oturum, dil ve arayüz tercihiniz için zorunlu çerezler kullanır. Reklam veya üçüncü taraf takip çerezi yoktur.",
    accept: "Anladım",
    details: "Ayrıntılar",
  },
};
