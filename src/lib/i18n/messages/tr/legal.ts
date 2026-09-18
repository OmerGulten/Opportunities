import type { MessageTree } from "../../config";

/**
 * Owned by the legal pages. MessageTree has no arrays, so paragraphs use
 * numbered keys (p1..pN); the page files declare how many exist per section.
 */
export const legal: MessageTree = {
  meta: {
    lastUpdated: "Son güncelleme: {{date}}",
    effectiveDate: "18 Eylül 2026",
    contactTitle: "İletişim",
    contactBody: "Bu belgelerle ilgili sorularınız ve veri talepleriniz için uygulama içindeki destek kanalından bize ulaşabilirsiniz.",
    tocTitle: "Bu sayfada",
    backHome: "Ana sayfaya dön",
  },
  terms: {
    title: "Kullanım Şartları",
    summary: "OpportunityOS'u kullanırken geçerli olan koşullar, sorumluluklarınız ve hizmetin sınırları.",
    s1: {
      title: "1. Taraflar ve kapsam",
      p1: "Bu şartlar, OpportunityOS hizmetini (“Hizmet”) kullanan gerçek veya tüzel kişi (“Kullanıcı”) ile hizmeti işleten taraf arasındaki ilişkiyi düzenler.",
      p2: "Hesap oluşturarak veya Hizmet'i kullanarak bu şartları kabul etmiş olursunuz. Kabul etmiyorsanız Hizmet'i kullanmayın.",
    },
    s2: {
      title: "2. Hizmetin tanımı",
      p1: "Hizmet; yerel işletmelerin herkese açık dijital varlıklarını keşfetmenize, gözlemlenebilir eksikleri denetlemenize, sattığınız hizmetlere göre fırsat puanları görmenize ve iletişim taslakları hazırlamanıza yardımcı olur.",
      p2: "Hizmet, satın alma olasılığı tahmini yapmaz ve size otomatik olarak müşteri kazandırmayı taahhüt etmez. Üretilen puanlar yalnızca gözlemlenen sinyallere ve yapılandırılabilir kurallara dayanır.",
      p3: "Hizmet, üçüncü taraf sağlayıcıların (örneğin harita ve yapay zeka sağlayıcıları) verilerine bağlıdır. Bu sağlayıcıların kesintileri veya politika değişiklikleri Hizmet'in bazı özelliklerini etkileyebilir.",
    },
    s3: {
      title: "3. Hesap ve çalışma alanı",
      p1: "Hesabınızın ve erişim bilgilerinizin güvenliğinden siz sorumlusunuz. Çalışma alanınıza davet ettiğiniz kullanıcıların eylemlerinden de sorumlusunuz.",
      p2: "Her çalışma alanı kendi verisine sahiptir. Çalışma alanı sahibi ve yöneticileri üyeleri, planı ve ayarları yönetebilir.",
    },
    s4: {
      title: "4. Kabul edilebilir kullanım",
      p1: "Hizmet'i yürürlükteki mevzuata, özellikle kişisel verilerin korunması ve elektronik ticaret mevzuatına aykırı biçimde kullanamazsınız.",
      p2: "Hizmet üzerinden toplu, otomatik veya istenmeyen (spam) ileti gönderimi yapılamaz. Hizmet ileti göndermez; yalnızca taslak hazırlar ve gönderim kararı ile gönderim eylemi size aittir.",
      p3: "Sağlayıcı verilerini sözleşmeye veya sağlayıcı koşullarına aykırı biçimde kopyalayamaz, yeniden dağıtamaz veya kalıcı olarak saklayamazsınız.",
    },
    s5: {
      title: "5. Krediler ve planlar",
      p1: "Tarama ve yapay zeka üretimi gibi işlemler kredi harcar. Kredi maliyetleri uygulama içinde gösterilir ve işlem öncesinde tahmini tutar sunulur.",
      p2: "Krediler işlem başlatıldığında rezerve edilir, tamamlanan işlem kadar tüketilir; kullanılmayan rezervasyon iade edilir. Krediler nakde çevrilemez.",
      p3: "Bu sürümde gerçek ödeme altyapısı devre dışıdır; plan değişiklikleri uygulama içinde yönetilir.",
    },
    s6: {
      title: "6. Fikri mülkiyet",
      p1: "Hizmet'in yazılımı, arayüzü ve markası hizmet sağlayıcıya aittir. Çalışma alanınıza girdiğiniz veriler ve oluşturduğunuz içerikler size aittir.",
      p2: "Hizmet'i kullanmanız için size devredilemez, münhasır olmayan ve süreli bir kullanım hakkı tanınır.",
    },
    s7: {
      title: "7. Sorumluluğun sınırı",
      p1: "Hizmet “olduğu gibi” sunulur. Üretilen puanlar, bulgular ve metin taslakları karar desteği amaçlıdır; ticari kararlarınızın sonucundan siz sorumlusunuz.",
      p2: "Dolaylı zararlar, kâr kaybı ve veri kaybı bakımından sorumluluk, yürürlükteki mevzuatın izin verdiği azami ölçüde sınırlıdır.",
    },
    s8: {
      title: "8. Askıya alma ve fesih",
      p1: "Bu şartların ihlali hâlinde hesabınız veya çalışma alanınız askıya alınabilir. Hesabınızı dilediğiniz zaman kapatabilirsiniz.",
      p2: "Hesap kapatıldığında verileriniz Gizlilik Politikası'ndaki saklama süreleri uyarınca silinir veya anonimleştirilir.",
    },
    s9: {
      title: "9. Değişiklikler ve uygulanacak hukuk",
      p1: "Bu şartlar güncellenebilir. Önemli değişiklikler uygulama içinde duyurulur ve bu sayfadaki güncelleme tarihi yenilenir.",
      p2: "Uyuşmazlıklarda Türkiye Cumhuriyeti hukuku uygulanır.",
    },
  },
  privacy: {
    title: "Gizlilik Politikası",
    summary: "Hangi verileri işliyoruz, neden işliyoruz, kimlerle paylaşıyoruz ve KVKK kapsamındaki haklarınız.",
    s1: {
      title: "1. Veri sorumlusu ve kapsam",
      p1: "Bu politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve ilgili mevzuat çerçevesinde, OpportunityOS hizmeti kullanılırken işlenen kişisel verileri açıklar.",
      p2: "Politika; hesap sahiplerini, çalışma alanı üyelerini ve keşif sonuçlarında yer alan işletme irtibat bilgilerini kapsar.",
    },
    s2: {
      title: "2. İşlenen veriler",
      p1: "Hesap verileri: ad soyad, e-posta adresi, dil ve arayüz tercihi, çalışma alanı üyeliği ve rolü.",
      p2: "Kullanım verileri: tarama kayıtları, kredi hareketleri, sağlayıcı çağrı kayıtları (süre, sonuç, hata kodu) ve uygulama içi etkinlik geçmişi.",
      p3: "İşletme verileri: harita sağlayıcısından gelen herkese açık işletme bilgileri (ad, adres, telefon, web sitesi, yorum sayıları) ile denetim sonucu üretilen bulgular. Bu veriler çoğunlukla işletmelere aittir; şahıs işletmelerinde kişisel veri niteliği taşıyabilir.",
    },
    s3: {
      title: "3. İşleme amaçları ve hukuki sebepler",
      p1: "Hesabınızı oluşturmak, oturumunuzu sürdürmek ve hizmeti sunmak: sözleşmenin kurulması ve ifası.",
      p2: "Kredi muhasebesi, kötüye kullanım önleme, güvenlik kayıtları ve hata ayıklama: meşru menfaat ve hukuki yükümlülük.",
      p3: "Hizmet iyileştirme ve toplu istatistik: meşru menfaat. Bu amaçla mümkün olan her yerde toplulaştırılmış veri kullanılır.",
    },
    s4: {
      title: "4. Veri işleyenler ve yurt dışına aktarım",
      p1: "Barındırma ve veritabanı: uygulama altyapısı ve Supabase (Postgres, kimlik doğrulama) hizmetleri.",
      p2: "Harita ve işletme verisi: Google Maps Platform (Places API). Sorgularınız ve alan seçimleriniz bu sağlayıcıya iletilir; sağlayıcı verileri yalnızca sağlayıcı koşullarının izin verdiği ölçüde ve süreyle saklanır.",
      p3: "Yapay zeka taslakları: OpenAI. Taslak üretimi için işletmeyle ilgili doğrulanmış bulgular ve sizin sağladığınız hizmet bilgileri iletilir. Hesap şifreleri, API anahtarları veya ödeme bilgileri asla iletilmez.",
      p4: "Bu sağlayıcıların sunucuları yurt dışında bulunabilir; aktarım KVKK'nın yurt dışına aktarım hükümleri çerçevesinde yapılır.",
    },
    s5: {
      title: "5. Saklama süreleri",
      p1: "Hesap ve çalışma alanı verileri, hesabınız aktif olduğu sürece saklanır.",
      p2: "Harita sağlayıcısından gelen içerik, sağlayıcı politikasının izin verdiği süre boyunca önbelleğe alınır; bu süre dolduğunda yenilenir veya silinir. Kalıcı olarak yalnızca sağlayıcı kimliği (place id) saklanır.",
      p3: "Kayıt ve denetim günlükleri en fazla 12 ay, kredi defteri kayıtları ise muhasebe bütünlüğü için hesabın ömrü boyunca saklanır.",
    },
    s6: {
      title: "6. KVKK kapsamındaki haklarınız",
      p1: "Kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme hakkına sahipsiniz.",
      p2: "Verilerin eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini, mevzuattaki şartlar çerçevesinde silinmesini veya yok edilmesini ve bu işlemlerin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteyebilirsiniz.",
      p3: "İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonuç ortaya çıkmasına itiraz edebilir ve kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep edebilirsiniz.",
    },
    s7: {
      title: "7. Silme ve dışa aktarma",
      p1: "Uygulama içinden çalışma alanı ve hesap silme talebi oluşturabilirsiniz. Talep alındıktan sonra veriler silinir veya geri döndürülemez biçimde anonimleştirilir; yasal saklama yükümlülüğü bulunan kayıtlar bu sürenin sonuna kadar saklanır.",
      p2: "Çalışma alanı verilerinizi uygulama içindeki dışa aktarma seçenekleriyle alabilirsiniz.",
    },
    s8: {
      title: "8. Güvenlik",
      p1: "Veriler aktarım sırasında şifrelenir; veritabanı erişimi satır düzeyinde güvenlik politikalarıyla çalışma alanı bazında sınırlandırılır.",
      p2: "Dış adreslere yapılan tüm istekler, iç ağ kaynaklarına erişimi engelleyen güvenli bir istemci üzerinden yapılır. Günlüklerde şifreler, anahtarlar ve mesaj içerikleri saklanmaz.",
    },
    s9: {
      title: "9. Otomatik karar ve yapay zeka",
      p1: "Fırsat puanları otomatik hesaplanır ancak yalnızca karar desteği amaçlıdır; sizin yerinize bir işlem yapmaz ve bir kişi hakkında hukuki sonuç doğurmaz.",
      p2: "Yapay zeka çıktıları taslaktır; gönderilmeden önce sizin tarafınızdan incelenir. Ayrıntılar için Yapay Zeka Bildirimi sayfasına bakın.",
    },
    s10: {
      title: "10. Değişiklikler",
      p1: "Bu politika güncellenebilir. Güncel sürüm her zaman bu sayfada yayımlanır ve üstteki güncelleme tarihi yenilenir.",
    },
  },
  cookies: {
    title: "Çerez Politikası",
    summary: "Yalnızca zorunlu çerezler kullanılır; reklam veya üçüncü taraf takip çerezi yoktur.",
    s1: {
      title: "1. Kullanılan çerezler",
      p1: "Oturum çerezi: giriş yapmış olmanızı sürdürmek için kimlik doğrulama sağlayıcısı tarafından ayarlanır. Bu çerez olmadan uygulama çalışmaz.",
      p2: "Çalışma alanı tercihi: en son kullandığınız çalışma alanını hatırlar ve sunucu tarafında doğrulanır.",
      p3: "Dil ve arayüz tercihi: seçtiğiniz dil ile açık/koyu tema tercihini hatırlar.",
    },
    s2: {
      title: "2. Kullanılmayan çerezler",
      p1: "Reklam, profilleme veya üçüncü taraf analitik çerezleri kullanılmaz. Bu nedenle çerez onayı bir tercih ekranı değil, bilgilendirme olarak sunulur.",
    },
    s3: {
      title: "3. Çerezleri yönetmek",
      p1: "Tarayıcınızın ayarlarından çerezleri silebilir veya engelleyebilirsiniz. Zorunlu çerezleri engellerseniz oturum açamaz ve uygulamayı kullanamazsınız.",
    },
    s4: {
      title: "4. Yerel depolama",
      p1: "Arayüz tercihleri (örneğin kenar çubuğunun açık kalması veya çerez bildiriminin kapatılmış olması) tarayıcınızın yerel depolamasında tutulur ve sunucuya gönderilmez.",
    },
  },
  ai: {
    title: "Yapay Zeka Bildirimi",
    summary: "Yapay zeka nerede kullanılır, hangi verilerle çalışır ve hangi sınırlara tabidir.",
    s1: {
      title: "1. Yapay zeka nerede kullanılır",
      p1: "Yapay zeka yalnızca iletişim taslakları yazmak ve bulguları insan diline çevirerek özetlemek için kullanılır.",
      p2: "Fırsat puanları yapay zeka ile üretilmez. Puanlar, gözlemlenen sinyaller üzerinde çalışan açık ve denetlenebilir bir kural motorundan çıkar.",
    },
    s2: {
      title: "2. Modele iletilen veriler",
      p1: "Modele yalnızca denetimden çıkan doğrulanmış bulgular, işletmenin herkese açık temel bilgileri ve sizin tanımladığınız hizmet/paket bilgileri iletilir.",
      p2: "Web sitelerinden alınan içerik güvenilmeyen veri olarak ele alınır; modele talimat olarak değil, yalnızca inceleme malzemesi olarak verilir.",
      p3: "Hesap şifreleri, oturum bilgileri, API anahtarları ve ödeme verileri hiçbir koşulda modele iletilmez.",
    },
    s3: {
      title: "3. Gerçeklere bağlılık",
      p1: "Taslaklar, kendilerine verilen bulguların dışına çıkamaz. Çıktı, iletilmeyen bir gerçeği öne sürerse otomatik denetim bunu işaretler ve metin yeniden üretilir veya ilgili iddia çıkarılır.",
      p2: "Buna rağmen dil modelleri hata yapabilir. Gönderim öncesinde metni okumak ve doğruluğunu teyit etmek kullanıcının sorumluluğundadır.",
    },
    s4: {
      title: "4. Gönderim kararı size aittir",
      p1: "Uygulama hiçbir mesajı otomatik göndermez. Taslaklar kopyalanır veya ilgili kanal sizin tarafınızdan açılarak elle gönderilir.",
      p2: "Toplu ve istenmeyen ileti gönderimi Kullanım Şartları'na aykırıdır.",
    },
    s5: {
      title: "5. Sağlayıcı ve devre dışı bırakma",
      p1: "Metin üretimi için OpenAI kullanılır. Sağlayıcı kimlik bilgileri tanımlı değilse uygulama, kurgusal örneklerle çalışan demo sağlayıcıya geçer ve arayüzde “Demo veri” etiketi gösterilir.",
      p2: "Yapay zeka özelliklerini kullanmadan da keşif, denetim ve puanlama akışını çalıştırabilirsiniz.",
    },
  },
};
