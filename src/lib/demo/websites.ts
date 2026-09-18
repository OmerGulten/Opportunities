import { DEMO_BUSINESSES, DEMO_WEBSITE_DOMAIN } from "./businesses";
import type { DemoBusiness, DemoWebsiteProfile } from "./types";

/**
 * Demo website fixtures. Eight quality profiles, each rendered per business so
 * the page carries that business's own name, phone and address. Served by
 * `createDemoFetcher()`, which mirrors the `SafeFetchResult` shape of the
 * security module so audits run unchanged in demo mode.
 */

export interface DemoSiteIdentity {
  hostname: string;
  scheme: "http" | "https";
  name: string;
  phoneNational: string | null;
  phoneInternational: string | null;
  address: string | null;
  instagram: string | null;
  openingHours: string[] | null;
  categoryKey: DemoBusiness["categoryKey"];
}

export interface DemoSite {
  hostname: string;
  scheme: "http" | "https";
  profile: DemoWebsiteProfile;
  /** Path -> HTML. "/" is the homepage. */
  pages: Record<string, string>;
  robotsTxt: string | null;
  sitemapXml: string | null;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function telHref(phoneInternational: string | null): string {
  return phoneInternational ? `tel:${phoneInternational.replace(/\s+/g, "")}` : "#";
}

function waHref(phoneInternational: string | null): string | null {
  return phoneInternational ? `https://wa.me/${phoneInternational.replace(/\D/g, "")}` : null;
}

const CATEGORY_WORDS: Record<DemoBusiness["categoryKey"], { what: string; cta: string; ctaPath: string; service: string }> = {
  restaurants_cafes: { what: "restoran", cta: "Rezervasyon Yap", ctaPath: "/rezervasyon", service: "Restaurant" },
  hair_salons: { what: "kuaför", cta: "Randevu Al", ctaPath: "/randevu", service: "HairSalon" },
  dentists: { what: "diş kliniği", cta: "Randevu Al", ctaPath: "/randevu", service: "Dentist" },
  gyms_pilates: { what: "spor stüdyosu", cta: "Deneme Dersi Al", ctaPath: "/randevu", service: "HealthClub" },
  real_estate: { what: "emlak ofisi", cta: "Ücretsiz Değerleme", ctaPath: "/iletisim", service: "RealEstateAgent" },
  accounting_tax: { what: "mali müşavirlik bürosu", cta: "Teklif Al", ctaPath: "/iletisim", service: "AccountingService" },
  education_courses: { what: "kurs merkezi", cta: "Ücretsiz Seviye Testi", ctaPath: "/randevu", service: "EducationalOrganization" },
  hotels: { what: "otel", cta: "Hemen Rezervasyon", ctaPath: "/rezervasyon", service: "Hotel" },
  auto_services: { what: "oto servis", cta: "Servis Randevusu", ctaPath: "/randevu", service: "AutoRepair" },
  beauty: { what: "güzellik merkezi", cta: "Randevu Al", ctaPath: "/randevu", service: "BeautySalon" },
  retail: { what: "mağaza", cta: "Koleksiyonu İncele", ctaPath: "/urunler", service: "Store" },
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

type Template = (site: DemoSiteIdentity, origin: string) => { pages: Record<string, string>; robotsTxt: string | null; sitemapXml: string | null };

function simplePage(site: DemoSiteIdentity, title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | ${esc(site.name)}</title>
<meta name="description" content="${esc(site.name)} – ${esc(title)} sayfası.">
<link rel="icon" href="/favicon.ico">
</head>
<body>
<header><a href="/">${esc(site.name)}</a></header>
<main><h1>${esc(title)}</h1>${body}</main>
<footer><p>© 2026 ${esc(site.name)}</p></footer>
</body>
</html>`;
}

function sitemapFor(origin: string, paths: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${origin}${p}</loc><changefreq>monthly</changefreq></url>`).join("\n")}
</urlset>`;
}

/** Strong: responsive, JSON-LD LocalBusiness, OG, canonical, CTA + booking, WhatsApp, Instagram, alt text. */
const strong: Template = (site, origin) => {
  const words = CATEGORY_WORDS[site.categoryKey];
  const wa = waHref(site.phoneInternational);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": words.service,
    name: site.name,
    url: origin,
    telephone: site.phoneInternational ?? undefined,
    address: site.address ? { "@type": "PostalAddress", streetAddress: site.address, addressLocality: "Kadıköy", addressRegion: "İstanbul", addressCountry: "TR" } : undefined,
    openingHours: site.openingHours ?? undefined,
    sameAs: site.instagram ? [site.instagram] : undefined,
  };
  const home = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.name)} – Kadıköy ${esc(words.what)} | Online ${esc(words.cta)}</title>
<meta name="description" content="${esc(site.name)}, Kadıköy'de ${esc(words.what)}. Çalışma saatleri, adres, fotoğraflar ve online ${esc(words.cta.toLowerCase())} için tıklayın.">
<link rel="canonical" href="${origin}/">
<link rel="icon" href="/favicon.ico">
<meta property="og:title" content="${esc(site.name)}">
<meta property="og:description" content="Kadıköy'de ${esc(words.what)}. ${esc(words.cta)}.">
<meta property="og:type" content="website">
<meta property="og:url" content="${origin}/">
<meta property="og:image" content="${origin}/images/kapak.jpg">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
:root{--brand:#0f766e}body{margin:0;font-family:system-ui,sans-serif;color:#1f2937}header{display:flex;justify-content:space-between;padding:1rem 1.5rem}
.btn{background:var(--brand);color:#fff;padding:.75rem 1.25rem;border-radius:.5rem;text-decoration:none}@media (max-width:640px){header{flex-direction:column}}
</style>
</head>
<body>
<header>
  <a href="/" class="logo"><img src="/images/logo.svg" alt="${esc(site.name)} logo" width="140" height="40"></a>
  <nav aria-label="Ana menü"><a href="/hakkimizda">Hakkımızda</a> <a href="/hizmetler">Hizmetler</a> <a href="/iletisim">İletişim</a></nav>
</header>
<main>
  <section class="hero">
    <h1>${esc(site.name)}</h1>
    <p>Kadıköy'ün kalbinde ${esc(words.what)}. Deneyimli ekibimizle sizi bekliyoruz.</p>
    <a class="btn" href="${words.ctaPath}">${esc(words.cta)}</a>
    ${wa ? `<a class="btn" href="${wa}">WhatsApp ile yazın</a>` : ""}
  </section>
  <section>
    <h2>Neden biz?</h2>
    <ul>
      <li>2012'den beri Kadıköy'de hizmet veriyoruz.</li>
      <li>Online ${esc(words.cta.toLowerCase())} ile bekleme yok.</li>
      <li>Müşteri memnuniyeti odaklı ekip.</li>
    </ul>
    <img src="/images/mekan-1.jpg" alt="${esc(site.name)} iç mekan" width="800" height="500" loading="lazy">
    <img src="/images/mekan-2.jpg" alt="${esc(site.name)} ekibi" width="800" height="500" loading="lazy">
  </section>
  <section id="saatler">
    <h2>Çalışma saatleri</h2>
    <ul>${(site.openingHours ?? []).map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
  </section>
</main>
<footer>
  <address>
    ${site.address ? `<p>${esc(site.address)}, Kadıköy / İstanbul</p>` : ""}
    ${site.phoneNational ? `<p>Telefon: <a href="${telHref(site.phoneInternational)}">${esc(site.phoneNational)}</a></p>` : ""}
    <p>E-posta: <a href="mailto:info@${site.hostname}">info@${site.hostname}</a></p>
  </address>
  ${site.instagram ? `<p><a href="${site.instagram}" rel="noopener">Instagram</a></p>` : ""}
  <p>© 2026 ${esc(site.name)}. Tüm hakları saklıdır.</p>
</footer>
</body>
</html>`;
  const pages: Record<string, string> = {
    "/": home,
    "/hakkimizda": simplePage(site, "Hakkımızda", `<p>${esc(site.name)} 2012 yılından bu yana Kadıköy'de hizmet veren bir ${esc(words.what)}.</p>`),
    "/hizmetler": simplePage(site, "Hizmetler", `<ul><li>Standart hizmet</li><li>Premium hizmet</li><li>Kurumsal çözümler</li></ul>`),
    "/iletisim": simplePage(site, "İletişim", `<p>${esc(site.address ?? "")}</p><p>${esc(site.phoneNational ?? "")}</p><form action="/iletisim" method="post"><label>Ad <input name="name"></label><button type="submit">Gönder</button></form>`),
    [words.ctaPath]: simplePage(site, words.cta, `<form action="${words.ctaPath}" method="post"><label>Tarih <input type="date" name="date"></label><label>Saat <input type="time" name="time"></label><button type="submit">${esc(words.cta)}</button></form>`),
  };
  if (site.categoryKey === "restaurants_cafes") {
    pages["/menu"] = simplePage(site, "Menü", `<ul><li>Günün çorbası – 90 ₺</li><li>Ev mantısı – 220 ₺</li><li>Izgara köfte – 260 ₺</li></ul>`);
  }
  const paths = Object.keys(pages);
  return {
    pages,
    robotsTxt: `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
    sitemapXml: sitemapFor(origin, paths),
  };
};

/** Average: SEO basics and contact info present; no schema, OG, CTA or social links; some images without alt. */
const average: Template = (site, origin) => {
  const words = CATEGORY_WORDS[site.categoryKey];
  const home = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(site.name)} - Kadıköy</title>
<meta name="description" content="${esc(site.name)} Kadıköy ${esc(words.what)}. Adres ve telefon bilgileri için web sitemizi ziyaret edin.">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div class="header">
  <img src="/img/logo.png" alt="${esc(site.name)}">
  <ul class="menu"><li><a href="/">Anasayfa</a></li><li><a href="/hakkimizda">Hakkımızda</a></li><li><a href="/iletisim">İletişim</a></li></ul>
</div>
<div class="content">
  <h1>${esc(site.name)}</h1>
  <p>Kadıköy'de ${esc(words.what)} olarak müşterilerimize kaliteli hizmet sunuyoruz. Uzun yıllara dayanan deneyimimiz ile sektörde güvenilir bir adres olmaya devam ediyoruz.</p>
  <h2>Hizmetlerimiz</h2>
  <p>Tüm hizmetlerimiz hakkında detaylı bilgi almak için bizi arayabilir veya ziyaret edebilirsiniz.</p>
  <img src="/img/foto1.jpg">
  <img src="/img/foto2.jpg">
  <img src="/img/foto3.jpg" alt="Mekan">
</div>
<div class="footer">
  <p>${esc(site.address ?? "")}, Kadıköy / İstanbul</p>
  <p>Tel: ${esc(site.phoneNational ?? "")}</p>
  <p>${esc(site.name)} © 2019</p>
</div>
</body>
</html>`;
  return {
    pages: {
      "/": home,
      "/hakkimizda": simplePage(site, "Hakkımızda", `<p>${esc(site.name)} hakkında.</p>`),
      "/iletisim": simplePage(site, "İletişim", `<p>${esc(site.address ?? "")}</p><p>${esc(site.phoneNational ?? "")}</p>`),
    },
    robotsTxt: `User-agent: *\nDisallow: /admin/\n`,
    sitemapXml: null,
  };
};

/** Corporate: strong SEO/schema, e-mail and phone, but no CTA and no social presence. */
const corporate: Template = (site, origin) => {
  const words = CATEGORY_WORDS[site.categoryKey];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["Organization", words.service],
    name: site.name,
    url: origin,
    telephone: site.phoneInternational ?? undefined,
    email: `info@${site.hostname}`,
  };
  const home = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.name)} | Kadıköy ${esc(words.what)} – Kurumsal hizmetler</title>
<meta name="description" content="${esc(site.name)}: Kadıköy merkezli ${esc(words.what)}. Kurumsal müşterilere yönelik danışmanlık, raporlama ve süreç yönetimi hizmetleri.">
<link rel="canonical" href="${origin}/">
<link rel="icon" href="/favicon.ico">
<meta property="og:title" content="${esc(site.name)}">
<meta property="og:description" content="Kadıköy merkezli ${esc(words.what)}.">
<meta property="og:url" content="${origin}/">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<header>
  <img src="/assets/logo.svg" alt="${esc(site.name)}" width="160" height="48">
  <nav><a href="/hizmetler">Hizmetler</a> <a href="/ekibimiz">Ekibimiz</a> <a href="/blog">Blog</a> <a href="/iletisim">İletişim</a></nav>
</header>
<main>
  <h1>${esc(site.name)}</h1>
  <p>Kurumsal ve bireysel müşterilerimize ${esc(words.what)} olarak mevzuata uygun, şeffaf ve zamanında hizmet sunuyoruz. Ekibimiz alanında sertifikalı uzmanlardan oluşur.</p>
  <h2>Hizmet alanlarımız</h2>
  <ul><li>Danışmanlık</li><li>Raporlama</li><li>Süreç yönetimi</li><li>Denetim desteği</li></ul>
  <h2>Yaklaşımımız</h2>
  <p>Her müşteri için ayrı bir uzman atarız ve düzenli raporlama yaparız. Detaylı bilgi için iletişim sayfamızı ziyaret edin.</p>
  <img src="/assets/ofis.jpg" alt="${esc(site.name)} ofis" width="900" height="600">
</main>
<footer>
  <p>${esc(site.address ?? "")}, Kadıköy / İstanbul</p>
  <p>Tel: <a href="${telHref(site.phoneInternational)}">${esc(site.phoneNational ?? "")}</a> · E-posta: <a href="mailto:info@${site.hostname}">info@${site.hostname}</a></p>
  <p>© 2026 ${esc(site.name)}</p>
</footer>
</body>
</html>`;
  const pages: Record<string, string> = {
    "/": home,
    "/hizmetler": simplePage(site, "Hizmetler", `<ul><li>Danışmanlık</li><li>Raporlama</li><li>Süreç yönetimi</li></ul>`),
    "/ekibimiz": simplePage(site, "Ekibimiz", `<p>Uzman ekibimiz alanında sertifikalıdır.</p>`),
    "/blog": simplePage(site, "Blog", `<article><h2>2026 mevzuat değişiklikleri</h2><p>Özet bilgi.</p></article>`),
    "/iletisim": simplePage(site, "İletişim", `<p>${esc(site.address ?? "")}</p><p>${esc(site.phoneNational ?? "")}</p><p>info@${site.hostname}</p>`),
  };
  return { pages, robotsTxt: `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, sitemapXml: sitemapFor(origin, Object.keys(pages)) };
};

/** Booking-focused but weak SEO: short title, no meta description, no H1, no OG; WhatsApp + booking CTA present. */
const bookingNoSeo: Template = (site, origin) => {
  const words = CATEGORY_WORDS[site.categoryKey];
  const wa = waHref(site.phoneInternational);
  const home = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.name)}</title>
<link rel="icon" href="/favicon.ico">
</head>
<body>
<nav><a href="/">Anasayfa</a> <a href="/randevu">Randevu</a></nav>
<section>
  <h2>${esc(site.name)}</h2>
  <p>Hızlı randevu için aşağıdaki butonları kullanabilirsiniz.</p>
  <a class="button" href="/randevu">${esc(words.cta)}</a>
  ${wa ? `<a class="button" href="${wa}">WhatsApp'tan Randevu</a>` : ""}
  <img src="/uploads/salon.jpg" alt="Salon">
  <img src="/uploads/ekip.jpg" alt="Ekip">
</section>
<section>
  <h3>Çalışma saatleri</h3>
  <ul>${(site.openingHours ?? []).map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
  <h3>Adres</h3>
  <p>${esc(site.address ?? "")}, Kadıköy</p>
  <p>Tel: <a href="${telHref(site.phoneInternational)}">${esc(site.phoneNational ?? "")}</a></p>
</section>
${site.instagram ? `<footer><a href="${site.instagram}">Instagram</a></footer>` : ""}
</body>
</html>`;
  const pages = {
    "/": home,
    "/randevu": simplePage(site, "Randevu", `<form method="post" action="/randevu"><input name="ad" placeholder="Ad Soyad"><input name="tel" placeholder="Telefon"><button type="submit">Randevu Al</button></form>`),
  };
  return { pages, robotsTxt: null, sitemapXml: sitemapFor(origin, Object.keys(pages)) };
};

/** Site-builder one-pager: generic title, noindex, duplicate H1s, contact form only, Instagram link. */
const templateGeneric: Template = (site, origin) => {
  const home = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Home</title>
<meta property="og:title" content="Home">
<meta property="og:image" content="${origin}/static/hero.jpg">
<link rel="stylesheet" href="/static/builder.css">
</head>
<body>
<section class="hero" style="background-image:url(/static/hero.jpg)">
  <h1>${esc(site.name)}</h1>
  <p>Welcome to our website</p>
  <a class="btn" href="#contact">İletişime Geçin</a>
</section>
<section>
  <h1>Hizmetlerimiz</h1>
  <div class="grid"><div>Hizmet 1</div><div>Hizmet 2</div><div>Hizmet 3</div></div>
</section>
<section id="contact">
  <h2>Bize ulaşın</h2>
  <form><input placeholder="Adınız"><input placeholder="E-posta"><textarea placeholder="Mesajınız"></textarea><button type="submit">Gönder</button></form>
</section>
<footer>
  ${site.instagram ? `<a href="${site.instagram}">Instagram</a>` : ""}
  <p>Made with SiteBuilder</p>
</footer>
</body>
</html>`;
  return { pages: { "/": home }, robotsTxt: null, sitemapXml: null };
};

/** Menu present, no contact details, no CTA, no social; images without alt. */
const menuNoContact: Template = (site) => {
  const home = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.name)} – Menü</title>
<meta name="description" content="${esc(site.name)} güncel menü ve fiyatlar.">
</head>
<body>
<header><h1>${esc(site.name)}</h1><nav><a href="/">Anasayfa</a> <a href="/menu">Menü</a></nav></header>
<main>
  <h2>Menü</h2>
  <section>
    <h3>Başlangıçlar</h3>
    <ul><li>Mercimek çorbası – 95 ₺</li><li>Humus – 140 ₺</li><li>Mevsim salatası – 160 ₺</li></ul>
    <h3>Ana yemekler</h3>
    <ul><li>Ev mantısı – 240 ₺</li><li>Izgara levrek – 420 ₺</li><li>Kuzu tandır – 480 ₺</li></ul>
    <h3>Tatlılar</h3>
    <ul><li>Sütlaç – 110 ₺</li><li>Künefe – 190 ₺</li></ul>
  </section>
  <img src="/foto/salon.jpg">
  <img src="/foto/tabak.jpg">
</main>
<footer><p>Fiyatlara KDV dahildir.</p></footer>
</body>
</html>`;
  return {
    pages: { "/": home, "/menu": home },
    robotsTxt: `User-agent: *\nAllow: /\n`,
    sitemapXml: null,
  };
};

/** Legacy: table layout, no viewport, no meta description, generic title, no H1, dead gallery link. */
const weakLegacy: Template = (site) => {
  const home = `<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>Anasayfa</title>
</head>
<body bgcolor="#FFFFFF">
<table width="800" border="0" cellpadding="4" align="center">
<tr><td colspan="2" align="center"><img src="baslik.gif" width="800" height="120"></td></tr>
<tr>
<td width="200" valign="top">
<font face="Verdana" size="2"><b>MENÜ</b></font><br>
<a href="index.htm">Anasayfa</a><br>
<a href="galeri.htm">Galeri</a><br>
<a href="iletisim.htm">İletişim</a><br>
</td>
<td valign="top">
<font face="Verdana" size="2">
<b>${esc(site.name)}</b>'ne hoşgeldiniz.<br><br>
Yıllardır Kadıköy'de hizmet vermekteyiz. Tel: ${esc(site.phoneNational ?? "")}<br><br>
<img src="resim1.jpg"> <img src="resim2.jpg">
</font>
</td>
</tr>
<tr><td colspan="2" align="center"><font size="1">Site tasarım 2009</font></td></tr>
</table>
</body>
</html>`;
  return {
    pages: {
      "/": home,
      "/index.htm": home,
      "/iletisim.htm": `<html><head><title>İletişim</title></head><body><font face="Verdana" size="2">${esc(site.address ?? "")}<br>Tel: ${esc(site.phoneNational ?? "")}</font></body></html>`,
    },
    robotsTxt: null,
    sitemapXml: null,
  };
};

/** Parked domain: single "under construction" page with almost no content. */
const underConstruction: Template = (site) => {
  const home = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.name)}</title>
</head>
<body style="text-align:center;font-family:sans-serif;padding-top:20vh">
<h1>${esc(site.name)}</h1>
<p>Sitemiz yapım aşamasındadır.</p>
</body>
</html>`;
  return { pages: { "/": home }, robotsTxt: null, sitemapXml: null };
};

const TEMPLATES: Record<Exclude<DemoWebsiteProfile, "unreachable">, Template> = {
  strong,
  average,
  corporate,
  booking_no_seo: bookingNoSeo,
  template_generic: templateGeneric,
  menu_no_contact: menuNoContact,
  weak_legacy: weakLegacy,
  under_construction: underConstruction,
};

// ---------------------------------------------------------------------------
// Site registry
// ---------------------------------------------------------------------------

function identityOf(business: DemoBusiness, hostname: string, scheme: "http" | "https"): DemoSiteIdentity {
  return {
    hostname,
    scheme,
    name: business.displayName,
    phoneNational: business.phoneNational,
    phoneInternational: business.phoneInternational,
    address: business.formattedAddress ? business.formattedAddress.replace(/, 34710 Kadıköy\/İstanbul, Türkiye$/, "") : null,
    instagram: business.socialProfiles?.find((s) => s.platform === "instagram")?.url ?? null,
    openingHours: business.openingHours?.weekdayDescriptions ?? null,
    categoryKey: business.categoryKey,
  };
}

function buildSites(): Record<string, DemoSite> {
  const sites: Record<string, DemoSite> = {};
  for (const business of DEMO_BUSINESSES) {
    if (!business.websiteUri || !business.websiteProfile || business.websiteProfile === "unreachable") continue;
    const url = new URL(business.websiteUri);
    const scheme = url.protocol === "http:" ? "http" : "https";
    const origin = `${scheme}://${url.hostname}`;
    const rendered = TEMPLATES[business.websiteProfile](identityOf(business, url.hostname, scheme), origin);
    sites[url.hostname] = { hostname: url.hostname, scheme, profile: business.websiteProfile, ...rendered };
  }
  return sites;
}

/** Hostname -> full fixture (all pages, robots, sitemap). */
export const DEMO_SITES: Readonly<Record<string, DemoSite>> = buildSites();

/** Hostname -> homepage HTML. */
export const DEMO_WEBSITE_HTML: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(DEMO_SITES).map(([host, site]) => [host, site.pages["/"]!]));

const NOT_FOUND_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested resource was not found on this server.</p></body></html>`;

function normalizePath(pathname: string): string {
  let path = pathname || "/";
  if (path === "/index.html" || path === "/index.php") path = "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

interface Resolved {
  site: DemoSite | null;
  hostname: string;
  path: string;
  requestedScheme: string;
  finalUrl: string;
  redirectChain: string[];
}

function resolve(rawUrl: string): Resolved | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const requestedScheme = url.protocol.slice(0, -1);
  const redirectChain: string[] = [];
  let hostname = url.hostname.toLowerCase();
  if (hostname.startsWith("www.") && DEMO_SITES[hostname.slice(4)]) hostname = hostname.slice(4);
  const site = DEMO_SITES[hostname] ?? null;
  const path = normalizePath(url.pathname);

  let finalScheme = requestedScheme;
  if (site && site.scheme === "https" && requestedScheme === "http") {
    // Realistic hosts upgrade to HTTPS; the fetcher reports the hop in redirectChain.
    redirectChain.push(rawUrl);
    finalScheme = "https";
  } else if (hostname !== url.hostname.toLowerCase()) {
    redirectChain.push(rawUrl);
  }
  const finalUrl = `${finalScheme}://${hostname}${path === "/" ? "/" : path}${url.search}`;
  return { site, hostname, path, requestedScheme, finalUrl, redirectChain };
}

/** Homepage/inner-page HTML for a demo URL; `null` when the host is not a demo fixture. */
export function getDemoWebsiteHtml(url: string): { html: string; status: number; finalUrl: string } | null {
  const resolved = resolve(url);
  if (!resolved || !resolved.site) return null;
  const page = resolved.site.pages[resolved.path];
  if (page === undefined) return { html: NOT_FOUND_HTML, status: 404, finalUrl: resolved.finalUrl };
  return { html: page, status: 200, finalUrl: resolved.finalUrl };
}

/** Mirrors `SafeFetchResult` from the security module so audits can swap fetchers. */
export interface DemoFetchResult {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  contentType: string | null;
  body: string;
  bytes: number;
  redirectChain: string[];
  durationMs: number;
  https: boolean;
  truncated: boolean;
}

export type DemoFetcher = (url: string, opts?: unknown) => Promise<DemoFetchResult>;

function methodOf(opts: unknown): string {
  if (typeof opts === "object" && opts !== null && "method" in opts) {
    const method = (opts as { method?: unknown }).method;
    if (typeof method === "string") return method.toUpperCase();
  }
  return "GET";
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Fetcher serving the fixtures: 200 for known pages, 404 for unknown paths and
 * unknown hosts, robots.txt / sitemap.xml where the profile has them, HEAD
 * support (empty body, same headers). Non-http(s) URLs are answered with 400.
 */
export function createDemoFetcher(): DemoFetcher {
  return async (url, opts) => {
    const started = Date.now();
    const method = methodOf(opts);
    const resolved = resolve(url);

    const respond = (status: number, body: string, contentType: string, finalUrl: string, redirectChain: string[], https: boolean): DemoFetchResult => {
      const isHead = method === "HEAD";
      const bytes = byteLength(body);
      return {
        url,
        finalUrl,
        status,
        ok: status >= 200 && status < 300,
        headers: {
          "content-type": contentType,
          "content-length": String(bytes),
          server: "demo-fixtures/1.0",
          date: new Date().toUTCString(),
        },
        contentType,
        body: isHead ? "" : body,
        bytes: isHead ? 0 : bytes,
        redirectChain,
        durationMs: Math.max(1, Date.now() - started),
        https,
        truncated: false,
      };
    };

    if (!resolved) return respond(400, "", "text/plain; charset=utf-8", url, [], url.startsWith("https://"));
    const https = resolved.finalUrl.startsWith("https://");
    if (!resolved.site) return respond(404, NOT_FOUND_HTML, "text/html; charset=utf-8", resolved.finalUrl, resolved.redirectChain, https);

    if (resolved.path === "/robots.txt") {
      return resolved.site.robotsTxt !== null
        ? respond(200, resolved.site.robotsTxt, "text/plain; charset=utf-8", resolved.finalUrl, resolved.redirectChain, https)
        : respond(404, NOT_FOUND_HTML, "text/html; charset=utf-8", resolved.finalUrl, resolved.redirectChain, https);
    }
    if (resolved.path === "/sitemap.xml") {
      return resolved.site.sitemapXml !== null
        ? respond(200, resolved.site.sitemapXml, "application/xml; charset=utf-8", resolved.finalUrl, resolved.redirectChain, https)
        : respond(404, NOT_FOUND_HTML, "text/html; charset=utf-8", resolved.finalUrl, resolved.redirectChain, https);
    }
    if (resolved.path === "/favicon.ico") {
      return respond(200, "", "image/x-icon", resolved.finalUrl, resolved.redirectChain, https);
    }

    const page = resolved.site.pages[resolved.path];
    if (page === undefined) return respond(404, NOT_FOUND_HTML, "text/html; charset=utf-8", resolved.finalUrl, resolved.redirectChain, https);
    return respond(200, page, "text/html; charset=utf-8", resolved.finalUrl, resolved.redirectChain, https);
  };
}

export { DEMO_WEBSITE_DOMAIN };
