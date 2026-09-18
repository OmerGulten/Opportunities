/** A well-built local business homepage: used as the "strong" quality fixture. */
export const STRONG_BUSINESS_NAME = "Deniz Restoran Kadıköy";

export const STRONG_HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Deniz Restoran Kadıköy | Balık ve Meze</title>
  <meta name="description" content="Kadıköy sahilinde günlük balık, ev yapımı meze ve zeytinyağlılar. Rezervasyon, çalışma saatleri ve iletişim bilgileri bu sayfada.">
  <link rel="canonical" href="https://denizrestoran.com/">
  <link rel="icon" href="/favicon.ico">
  <meta property="og:title" content="Deniz Restoran Kadıköy">
  <meta property="og:description" content="Kadıköy sahilinde günlük balık ve ev yapımı meze.">
  <meta property="og:image" content="https://denizrestoran.com/img/og.jpg">
  <meta property="og:site_name" content="Deniz Restoran Kadıköy">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Restaurant", "LocalBusiness"],
        "name": "Deniz Restoran Kadıköy",
        "telephone": "+90 216 123 45 67",
        "address": { "@type": "PostalAddress", "streetAddress": "Caferağa Mah. Moda Cad. No:12", "addressLocality": "Kadıköy" },
        "openingHoursSpecification": { "@type": "OpeningHoursSpecification", "opens": "12:00", "closes": "23:00" }
      }
    ]
  }
  </script>
  <link rel="stylesheet" href="/css/site.css">
  <script src="/js/app.js" defer></script>
</head>
<body>
  <header>
    <a href="/"><img class="logo" src="/img/logo.svg" alt="Deniz Restoran Kadıköy logo" width="180" height="48"></a>
    <nav>
      <a href="/menu">Menü</a>
      <a href="/rezervasyon">Rezervasyon Yap</a>
      <a href="/iletisim">İletişim</a>
      <a href="tel:+902161234567">Bizi Arayın</a>
      <a href="https://wa.me/905321234567">WhatsApp</a>
    </nav>
  </header>
  <main>
    <h1>Deniz Restoran Kadıköy</h1>
    <p>
      Kadıköy sahilinde 1998 yılından bu yana günlük balık ve ev yapımı meze sunuyoruz. Mutfağımızda her sabah
      halden gelen ürünlerle çalışıyor, mevsimine göre değişen bir menü hazırlıyoruz. Zeytinyağlılarımız kendi
      üretimimiz olan sızma zeytinyağı ile yapılır. Salonumuzda altmış kişilik oturma alanı, sahile bakan
      terasımızda ise kırk kişilik ek bölüm bulunur. Aile toplantıları, doğum günleri ve kurumsal akşam yemekleri
      için terası tümüyle ayırabiliyoruz. Rezervasyonlarınızı telefonla ya da sayfamızdaki rezervasyon formu ile
      oluşturabilirsiniz. Gelmeden önce günün balıklarını sormak isterseniz mutfağımız her gün saat on birden
      itibaren telefonlara yanıt veriyor. Otopark ihtiyacı olan misafirlerimiz için sokağın karşısındaki katlı
      otopark ile anlaşmamız bulunuyor ve bir saatlik kullanım ücretsizdir.
    </p>
    <h2>Menümüz</h2>
    <p>
      Günlük balık tabelamız her akşam yeniden yazılır. Meze tabağımızda on iki çeşit bulunur ve tamamı gün içinde
      hazırlanır. Vejetaryen misafirlerimiz için ayrı bir bölümümüz vardır.
    </p>
    <img src="/img/meze.jpg" alt="Meze tabağı" width="640" height="420">
    <h2>Çalışma Saatleri ve Adres</h2>
    <p>Pazartesi - Pazar 12:00 - 23:00 arasında hizmet veriyoruz.</p>
    <address>Caferağa Mah. Moda Cad. No:12, Kadıköy, İstanbul</address>
    <img src="/img/salon.jpg" alt="Restoran salonu" width="640" height="420">
  </main>
  <footer>
    <a href="https://www.instagram.com/denizrestoran">Instagram</a>
    <a href="https://www.facebook.com/denizrestoran">Facebook</a>
    <a href="mailto:bilgi@denizrestoran.com">bilgi@denizrestoran.com</a>
    <p>0216 123 45 67</p>
  </footer>
</body>
</html>`;
