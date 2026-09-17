-- ============================================================================
-- OpportunityOS reference seed
-- Idempotent: safe to run repeatedly (upserts on natural keys).
-- No real people or real businesses. Demo businesses live in src/lib/demo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Plans
-- ----------------------------------------------------------------------------
insert into public.plans (key, name, description, monthly_credits, price_monthly, currency, max_members, features, is_default, active, sort_order) values
  ('free',    'Free',    'Try OpportunityOS with a small monthly credit grant.', 100,  0,    'TRY', 1,  '{"deep_audit": false, "competitor_benchmark": false, "public_reports": true, "api_keys": false}', true,  true, 10),
  ('starter', 'Starter', 'For freelancers running a few scans a month.',          750,  499,  'TRY', 2,  '{"deep_audit": true,  "competitor_benchmark": true,  "public_reports": true, "api_keys": false}', false, true, 20),
  ('pro',     'Pro',     'For small agencies with multiple sellers.',              2500, 1499, 'TRY', 5,  '{"deep_audit": true,  "competitor_benchmark": true,  "public_reports": true, "api_keys": true}',  false, true, 30),
  ('agency',  'Agency',  'High-volume prospecting for agencies.',                  8000, 3999, 'TRY', 15, '{"deep_audit": true,  "competitor_benchmark": true,  "public_reports": true, "api_keys": true}',  false, true, 40)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, monthly_credits = excluded.monthly_credits,
  price_monthly = excluded.price_monthly, max_members = excluded.max_members, features = excluded.features,
  is_default = excluded.is_default, active = excluded.active, sort_order = excluded.sort_order;

-- ----------------------------------------------------------------------------
-- Credit pricing rules
-- ----------------------------------------------------------------------------
insert into public.credit_pricing_rules (key, name, cost, unit, active) values
  ('discovery',            'Business discovery',      1, 'per_business', true),
  ('basic_audit',          'Basic audit',             2, 'per_business', true),
  ('deep_audit',           'Deep audit',              4, 'per_business', true),
  ('ai_message',           'AI message generation',   1, 'per_message',  true),
  ('report',               'Public report',           1, 'per_report',   true),
  ('competitor_benchmark', 'Competitor benchmark',    3, 'per_business', true)
on conflict (key) do update set name = excluded.name, cost = excluded.cost, unit = excluded.unit, active = excluded.active;

-- ----------------------------------------------------------------------------
-- System settings (feature flags, rate limits, scan limits, AI config)
-- ----------------------------------------------------------------------------
insert into public.system_settings (key, value, description) values
  ('features', '{"real_payments": false, "competitor_benchmark": true, "pagespeed": true, "instagram_discovery": true, "export_provider_content": false, "public_reports": true, "api_keys": true}', 'Platform feature flags'),
  ('rate_limits', '{"scan_create": {"limit": 10, "window_seconds": 3600}, "ai_generate": {"limit": 60, "window_seconds": 3600}, "website_audit": {"limit": 120, "window_seconds": 3600}, "enrichment": {"limit": 120, "window_seconds": 3600}, "public_report": {"limit": 120, "window_seconds": 60}, "auth": {"limit": 20, "window_seconds": 600}, "api_default": {"limit": 600, "window_seconds": 60}}', 'Rate limits per key'),
  ('scan', '{"max_businesses_per_scan": 200, "max_radius_m": 15000, "min_radius_m": 200, "default_cell_radius_m": 800, "max_polygon_area_km2": 60, "secondary_service_threshold": 50, "high_opportunity_threshold": 70, "audit_concurrency": 5}', 'Scan engine limits'),
  ('ai', '{"default_tone": "friendly_professional", "max_output_tokens": 700, "temperature": 0.7, "prompt_version": "v1"}', 'AI generation defaults'),
  ('providers', '{"places": {"max_result_count": 20, "details_cache_hours": 720, "language_code": "tr", "region_code": "TR"}, "pagespeed": {"strategy": "mobile"}}', 'Provider configuration (non-secret)'),
  ('public.branding', '{"product_name": "OpportunityOS", "tagline_tr": "Keşfet. Denetle. Fırsatı gör. Ulaş. Kazan.", "tagline_en": "Discover. Audit. See the opportunity. Reach out. Win."}', 'Public branding strings')
on conflict (key) do update set value = excluded.value, description = excluded.description;

-- ----------------------------------------------------------------------------
-- Categories
-- ----------------------------------------------------------------------------
insert into public.categories (key, name_tr, name_en, icon, sort_order, active) values
  ('restaurants_cafes', 'Restoran & Kafe',        'Restaurants & Cafes',  'utensils',      10, true),
  ('hair_salons',       'Kuaför & Berber',        'Hair Salons',          'scissors',      20, true),
  ('dentists',          'Diş Hekimleri',          'Dentists',             'stethoscope',   30, true),
  ('gyms_pilates',      'Spor Salonu & Pilates',  'Gyms & Pilates',       'dumbbell',      40, true),
  ('real_estate',       'Emlak',                  'Real Estate',          'building-2',    50, true),
  ('accounting_tax',    'Muhasebe & Mali Müşavir','Accounting & Tax',     'calculator',    60, true),
  ('education_courses', 'Eğitim & Kurslar',       'Education & Courses',  'graduation-cap',70, true),
  ('hotels',            'Otel & Konaklama',       'Hotels',               'bed-double',    80, true),
  ('auto_services',     'Oto Servis',             'Auto Services',        'car',           90, true),
  ('beauty',            'Güzellik & Bakım',       'Beauty',               'sparkles',     100, true),
  ('retail',            'Perakende Mağaza',       'Retail',               'shopping-bag', 110, true)
on conflict (key) do update set name_tr = excluded.name_tr, name_en = excluded.name_en, icon = excluded.icon, sort_order = excluded.sort_order, active = excluded.active;

-- Category -> provider type mappings (Google Places API (New) Table A types)
with m(category_key, provider_type, query_text, priority) as (values
  ('restaurants_cafes', 'restaurant', null, 10),
  ('restaurants_cafes', 'cafe', null, 20),
  ('restaurants_cafes', 'coffee_shop', null, 30),
  ('restaurants_cafes', 'bakery', null, 40),
  ('restaurants_cafes', 'bar', null, 50),
  ('hair_salons', 'hair_salon', null, 10),
  ('hair_salons', 'barber_shop', null, 20),
  ('dentists', 'dentist', null, 10),
  ('dentists', 'dental_clinic', null, 20),
  ('gyms_pilates', 'gym', null, 10),
  ('gyms_pilates', 'fitness_center', null, 20),
  ('gyms_pilates', 'yoga_studio', null, 30),
  ('gyms_pilates', null, 'pilates stüdyosu', 40),
  ('real_estate', 'real_estate_agency', null, 10),
  ('accounting_tax', 'accounting', null, 10),
  ('accounting_tax', null, 'mali müşavir', 20),
  ('education_courses', 'school', null, 10),
  ('education_courses', null, 'kurs merkezi', 20),
  ('education_courses', null, 'dil kursu', 30),
  ('hotels', 'hotel', null, 10),
  ('hotels', 'lodging', null, 20),
  ('hotels', 'guest_house', null, 30),
  ('auto_services', 'car_repair', null, 10),
  ('auto_services', 'car_wash', null, 20),
  ('auto_services', 'car_dealer', null, 30),
  ('beauty', 'beauty_salon', null, 10),
  ('beauty', 'spa', null, 20),
  ('beauty', 'nail_salon', null, 30),
  ('beauty', 'skin_care_clinic', null, 40),
  ('retail', 'clothing_store', null, 10),
  ('retail', 'shoe_store', null, 20),
  ('retail', 'jewelry_store', null, 30),
  ('retail', 'gift_shop', null, 40),
  ('retail', 'furniture_store', null, 50),
  ('retail', 'electronics_store', null, 60)
)
insert into public.category_provider_mappings (category_id, provider, provider_type, query_text, priority, active)
select c.id, 'google_places', m.provider_type, m.query_text, m.priority, true
from m join public.categories c on c.key = m.category_key
on conflict (category_id, provider, provider_type, query_text) do update set priority = excluded.priority, active = true;

-- Demo provider mirrors the Google mappings
insert into public.category_provider_mappings (category_id, provider, provider_type, query_text, priority, active)
select category_id, 'demo', provider_type, query_text, priority, true
from public.category_provider_mappings where provider = 'google_places'
on conflict (category_id, provider, provider_type, query_text) do nothing;

-- ----------------------------------------------------------------------------
-- Services
-- ----------------------------------------------------------------------------
insert into public.services (key, name_tr, name_en, description_tr, description_en, icon, score_normalizer, sort_order, active) values
  ('website_development', 'Web Sitesi Geliştirme',      'Website Development',           'Web sitesi olmayan veya zayıf web sitesine sahip işletmeler.', 'Businesses with no website or a weak website.', 'globe', 100, 10, true),
  ('seo',                 'SEO',                        'SEO',                           'Arama görünürlüğü ve teknik SEO eksikleri.', 'Search visibility and technical SEO gaps.', 'search', 100, 20, true),
  ('social_media',        'Sosyal Medya Yönetimi',      'Social Media Management',       'Eksik veya pasif sosyal medya varlığı.', 'Missing or inactive social presence.', 'instagram', 100, 30, true),
  ('google_business',     'Google İşletme Optimizasyonu','Google Business Optimization',  'Eksik Google İşletme Profili bilgileri.', 'Incomplete Google Business Profile.', 'map-pin', 100, 40, true),
  ('review_management',   'Yorum Yönetimi',             'Review Management',             'Yanıtlanmayan yorumlar ve itibar fırsatları.', 'Unanswered reviews and reputation gaps.', 'message-square', 100, 50, true),
  ('branding',            'Marka & Logo',               'Branding & Logo',               'Zayıf marka tutarlılığı sinyalleri.', 'Weak brand consistency signals.', 'palette', 100, 60, true)
on conflict (key) do update set name_tr = excluded.name_tr, name_en = excluded.name_en, description_tr = excluded.description_tr,
  description_en = excluded.description_en, icon = excluded.icon, score_normalizer = excluded.score_normalizer, sort_order = excluded.sort_order, active = excluded.active;

-- ----------------------------------------------------------------------------
-- Service rules (defaults; admin-editable)
-- operator semantics: see src/lib/scoring/operators.ts
-- ----------------------------------------------------------------------------
with r(service_key, key, name_tr, name_en, explanation_tr, explanation_en, signal_type, operator, value, points, min_confidence, requires_depth, sort_order) as (values
  -- Website Development
  ('website_development', 'no_website',        'Web sitesi bulunamadı',           'No website found',              'İşletme profilinde web sitesi bağlantısı bulunamadı.',            'No website URL was found on the business profile.',          'website.status',          'in',       '["not_found","invalid","unreachable"]', 55, 'medium', 'discovery', 10),
  ('website_development', 'weak_website',      'Zayıf web sitesi',                'Weak website',                  'Web sitesi denetimi düşük kalite sinyalleri gösteriyor.',         'The website audit shows low quality signals.',               'website.quality',         'eq',       '"weak"',   30, 'medium', 'basic', 20),
  ('website_development', 'average_website',   'Geliştirilebilir web sitesi',     'Website could be improved',     'Web sitesi denetimi orta düzey kalite sinyalleri gösteriyor.',     'The website audit shows average quality signals.',           'website.quality',         'eq',       '"average"', 10, 'medium', 'basic', 25),
  ('website_development', 'no_cta',            'Görünür eylem çağrısı yok',       'No visible call to action',     'Sayfada görünür bir eylem çağrısı (ara, rezervasyon, iletişim) tespit edilmedi.', 'No visible call to action (call, book, contact) was detected on the page.', 'website.has_cta', 'is_false', null, 10, 'medium', 'basic', 30),
  ('website_development', 'no_contact_info',   'İletişim bilgisi yok',            'No contact information',        'Sayfada telefon, adres veya iletişim bilgisi tespit edilmedi.',    'No phone, address or contact information was detected on the page.', 'website.has_contact_info', 'is_false', null, 10, 'medium', 'basic', 40),
  ('website_development', 'no_booking',        'Rezervasyon akışı yok',           'No booking flow',               'Online rezervasyon veya randevu akışı tespit edilmedi.',          'No online booking or appointment flow was detected.',        'website.has_booking',     'is_false', null, 5,  'medium', 'basic', 50),
  ('website_development', 'not_mobile_friendly','Mobil uyum zayıf',               'Weak mobile friendliness',      'Sezgisel kontroller mobil uyumun zayıf olduğunu gösteriyor.',      'Heuristic checks indicate weak mobile friendliness.',        'website.mobile_friendly', 'is_false', null, 10, 'low', 'basic', 60),
  ('website_development', 'no_https',          'HTTPS yok',                       'No HTTPS',                      'Web sitesi güvenli bağlantı (HTTPS) kullanmıyor.',                 'The website does not use a secure connection (HTTPS).',      'website.https',           'is_false', null, 10, 'high', 'basic', 70),
  -- SEO
  ('seo', 'no_website',            'Web sitesi bulunamadı',      'No website found',             'Web sitesi olmadan arama görünürlüğü sınırlıdır.',                 'Search visibility is limited without a website.',            'website.status',              'in',       '["not_found","invalid","unreachable"]', 30, 'medium', 'discovery', 10),
  ('seo', 'missing_title',         'Başlık etiketi eksik',       'Missing title tag',            'Sayfa başlığı (title) bulunamadı.',                                'The page title tag is missing.',                             'website.has_meta_title',      'is_false', null, 10, 'high', 'basic', 20),
  ('seo', 'weak_title',            'Zayıf başlık etiketi',       'Weak title tag',               'Sayfa başlığı çok kısa, çok uzun veya genel.',                     'The page title is too short, too long or generic.',          'website.title_quality',       'eq',       '"weak"', 5, 'medium', 'basic', 25),
  ('seo', 'missing_description',   'Meta açıklama eksik',        'Missing meta description',     'Meta açıklama bulunamadı.',                                        'The meta description is missing.',                           'website.has_meta_description','is_false', null, 10, 'high', 'basic', 30),
  ('seo', 'missing_schema',        'Yapısal veri eksik',         'Missing structured data',      'schema.org yapısal verisi tespit edilmedi.',                       'No schema.org structured data was detected.',                'website.has_schema',          'is_false', null, 10, 'high', 'basic', 40),
  ('seo', 'missing_sitemap',       'Sitemap yok',                'No sitemap',                   'sitemap.xml bulunamadı.',                                          'sitemap.xml was not found.',                                 'website.has_sitemap',         'is_false', null, 10, 'medium', 'basic', 50),
  ('seo', 'missing_robots',        'robots.txt yok',             'No robots.txt',                'robots.txt bulunamadı.',                                           'robots.txt was not found.',                                  'website.has_robots',          'is_false', null, 5,  'medium', 'basic', 60),
  ('seo', 'missing_h1',            'H1 başlığı eksik',           'Missing H1',                   'Sayfada H1 başlığı bulunamadı.',                                   'No H1 heading was found on the page.',                       'website.has_h1',              'is_false', null, 10, 'high', 'basic', 70),
  ('seo', 'missing_canonical',     'Canonical etiketi eksik',    'Missing canonical',            'Canonical etiketi bulunamadı.',                                    'No canonical tag was found.',                                'website.has_canonical',       'is_false', null, 5,  'high', 'basic', 80),
  ('seo', 'poor_mobile_performance','Zayıf mobil performans',    'Poor mobile performance',      'Mobil performans skoru düşük.',                                    'The mobile performance score is low.',                       'performance.mobile_score',    'lt',       '50', 20, 'low', 'deep', 90),
  ('seo', 'mid_mobile_performance','Geliştirilebilir mobil performans','Mobile performance could improve','Mobil performans skoru orta düzeyde.',                   'The mobile performance score is mid-range.',                 'performance.mobile_score',    'between',  '[50,89]', 10, 'low', 'deep', 95),
  ('seo', 'missing_language',      'Dil etiketi eksik',          'Missing language attribute',   'HTML dil etiketi tanımlanmamış.',                                  'The HTML language attribute is not declared.',               'website.language_declared',   'is_false', null, 5,  'high', 'basic', 100),
  -- Social Media
  ('social_media', 'no_instagram',        'Instagram profili bulunamadı', 'No Instagram profile found', 'Kontrol edilen kaynaklarda Instagram profili bulunamadı.',        'No Instagram profile was found in the sources checked.',     'instagram.status',            'eq',       '"not_found"', 40, 'medium', 'basic', 10),
  ('social_media', 'ambiguous_instagram', 'Instagram profili belirsiz',   'Instagram profile ambiguous', 'Instagram profili net olarak eşleştirilemedi.',                  'The Instagram profile could not be matched with confidence.','instagram.status',            'eq',       '"ambiguous"', 10, 'low', 'basic', 15),
  ('social_media', 'inactive_instagram',  'Pasif Instagram profili',      'Inactive Instagram profile',  'Son paylaşım uzun süre önce görünüyor.',                          'The last visible post appears to be a long time ago.',       'instagram.is_active',         'is_false', null, 25, 'medium', 'basic', 20),
  ('social_media', 'no_website_link',     'Profilde web sitesi bağlantısı yok', 'No website link on profile', 'Profilde web sitesi bağlantısı görünmüyor.',                'No website link is visible on the profile.',                 'instagram.has_website_link',  'is_false', null, 10, 'medium', 'basic', 30),
  ('social_media', 'incomplete_bio',      'Eksik biyografi',              'Incomplete bio',              'Profil biyografisi eksik görünüyor.',                              'The profile bio appears incomplete.',                        'instagram.bio_complete',      'is_false', null, 10, 'medium', 'basic', 40),
  ('social_media', 'no_social_links_on_site','Web sitesinde sosyal bağlantı yok','No social links on website','Web sitesinde sosyal medya bağlantısı tespit edilmedi.',     'No social media links were detected on the website.',       'website.has_social_links',    'is_false', null, 15, 'high', 'basic', 50),
  ('social_media', 'few_photos',          'Az görsel içerik',             'Few photos',                  'Google profilinde az sayıda fotoğraf var.',                        'The Google profile has few photos.',                         'google.photo_count',          'lt',       '5', 10, 'medium', 'discovery', 60),
  -- Google Business
  ('google_business', 'missing_hours',     'Çalışma saatleri eksik',      'Missing opening hours',        'Profilde çalışma saatleri görünmüyor.',                            'Opening hours are not shown on the profile.',                'google.has_opening_hours',    'is_false', null, 15, 'high', 'discovery', 10),
  ('google_business', 'few_photos',        'Az fotoğraf',                 'Few photos',                   'Profilde 5''ten az fotoğraf var.',                                 'The profile has fewer than 5 photos.',                       'google.photo_count',          'lt',       '5', 15, 'medium', 'discovery', 20),
  ('google_business', 'missing_phone',     'Telefon eksik',               'Missing phone',                'Profilde telefon numarası görünmüyor.',                            'No phone number is shown on the profile.',                   'google.has_phone',            'is_false', null, 15, 'high', 'discovery', 30),
  ('google_business', 'missing_website',   'Web sitesi bağlantısı eksik', 'Missing website link',         'Profilde web sitesi bağlantısı görünmüyor.',                       'No website link is shown on the profile.',                   'google.has_website',          'is_false', null, 20, 'high', 'discovery', 40),
  ('google_business', 'low_review_count',  'Az yorum',                    'Low review count',             'Profilde 10''dan az yorum var.',                                   'The profile has fewer than 10 reviews.',                     'google.review_count',         'lt',       '10', 15, 'high', 'discovery', 50),
  ('google_business', 'low_rating',        'Düşük puan',                  'Low rating',                   'Ortalama puan 4.0''ın altında.',                                   'The average rating is below 4.0.',                           'google.rating',               'lt',       '4.0', 10, 'high', 'discovery', 60),
  ('google_business', 'incomplete_profile','Eksik profil',                'Incomplete profile',           'Profil bütünlük skoru düşük.',                                     'The profile completeness score is low.',                     'google.completeness_score',   'lt',       '60', 10, 'medium', 'discovery', 70),
  -- Review Management
  ('review_management', 'low_response_rate',      'Düşük yorum yanıt oranı',   'Low review response rate',    'Örneklenen yorumların çoğu işletme tarafından yanıtlanmamış.',   'Most sampled reviews have no owner response.',               'google.review_response_rate', 'lt',       '0.3', 30, 'low', 'basic', 10),
  ('review_management', 'many_reviews',           'Çok sayıda yorum',          'Many reviews',                'Yönetilmesi gereken 50''den fazla yorum var.',                   'There are more than 50 reviews to manage.',                  'google.review_count',         'gte',      '50', 10, 'high', 'discovery', 20),
  ('review_management', 'recent_unanswered',      'Yanıtsız güncel yorumlar',  'Recent unanswered reviews',   'Örneklenen güncel yorumlar arasında yanıtsız olanlar var.',      'Sampled recent reviews include unanswered ones.',            'google.recent_unanswered_reviews','gte',   '2', 20, 'low', 'basic', 30),
  ('review_management', 'mid_rating',             'Geliştirilebilir puan',     'Rating could improve',        'Ortalama puan 3.0 ile 4.2 arasında.',                             'The average rating is between 3.0 and 4.2.',                 'google.rating',               'between',  '[3.0,4.2]', 20, 'high', 'discovery', 40),
  ('review_management', 'very_low_rating',        'Çok düşük puan',            'Very low rating',             'Ortalama puan 3.0''ın altında.',                                  'The average rating is below 3.0.',                           'google.rating',               'lt',       '3.0', 25, 'high', 'discovery', 50),
  ('review_management', 'needs_reviews',          'Yorum kazanımı gerekli',    'Needs review acquisition',    'Profilde 10''dan az yorum var.',                                  'The profile has fewer than 10 reviews.',                     'google.review_count',         'lt',       '10', 15, 'high', 'discovery', 60),
  -- Branding
  ('branding', 'no_logo_signal',        'Logo sinyali yok',            'No logo signal',              'Web sitesinde logo veya paylaşım görseli tespit edilmedi.',      'No logo or share image was detected on the website.',        'branding.has_logo_signal',    'is_false', null, 25, 'medium', 'basic', 10),
  ('branding', 'name_inconsistent',     'İsim tutarsızlığı',           'Name inconsistency',          'Web sitesi başlığı işletme adını içermiyor.',                     'The website title does not include the business name.',     'branding.name_consistency',   'is_false', null, 20, 'medium', 'basic', 20),
  ('branding', 'no_favicon',            'Favicon yok',                 'No favicon',                  'Web sitesinde favicon bulunamadı.',                               'No favicon was found on the website.',                       'website.has_favicon',         'is_false', null, 15, 'high', 'basic', 30),
  ('branding', 'no_open_graph',         'Paylaşım görseli yok',        'No Open Graph data',          'Sosyal paylaşım (Open Graph) etiketleri bulunamadı.',            'No Open Graph tags were found.',                             'website.has_open_graph',      'is_false', null, 15, 'high', 'basic', 40),
  ('branding', 'low_consistency',       'Düşük marka tutarlılığı',     'Low brand consistency',       'Sezgisel marka tutarlılık skoru düşük.',                          'The heuristic brand consistency score is low.',              'branding.consistency_score',  'lt',       '50', 25, 'low', 'basic', 50),
  ('branding', 'no_web_presence',       'Web marka varlığı yok',       'No web brand presence',       'Web sitesi olmadan marka varlığı sınırlı.',                        'Brand presence is limited without a website.',               'website.status',              'in',       '["not_found","invalid","unreachable"]', 20, 'medium', 'discovery', 60)
)
insert into public.service_rules (service_id, key, name_tr, name_en, explanation_tr, explanation_en, signal_type, operator, value, points, min_confidence, requires_depth, active, sort_order)
select s.id, r.key, r.name_tr, r.name_en, r.explanation_tr, r.explanation_en, r.signal_type, r.operator,
       case when r.value is null then null else r.value::jsonb end,
       r.points, r.min_confidence::public.confidence_level, r.requires_depth::public.audit_depth, true, r.sort_order
from r join public.services s on s.key = r.service_key
on conflict (service_id, key) do update set
  name_tr = excluded.name_tr, name_en = excluded.name_en, explanation_tr = excluded.explanation_tr, explanation_en = excluded.explanation_en,
  signal_type = excluded.signal_type, operator = excluded.operator, value = excluded.value, points = excluded.points,
  min_confidence = excluded.min_confidence, requires_depth = excluded.requires_depth, sort_order = excluded.sort_order, active = true;

-- ----------------------------------------------------------------------------
-- Built-in message templates (system scope). Variables resolve from verified data only.
-- ----------------------------------------------------------------------------
with t(key, name, channel, service_key, tone, locale, subject, body, variables) as (values
  ('no_website_tr', 'Web Sitesi Yok', 'whatsapp', 'website_development', 'friendly_professional', 'tr', null,
   $tpl$Merhaba {{business_name}} ekibi,

Ben {{sender_name}}, {{workspace_name}} adına yazıyorum. {{district}} bölgesindeki işletmeleri incelerken Google İşletme profilinizde bir web sitesi bağlantısı görünmediğini fark ettim.

{{rating}} puan ve {{review_count}} yorumla güçlü bir müşteri ilgisine sahipsiniz; bu ilgiyi menü, iletişim ve rezervasyon bilgilerini tek yerde toplayan sade bir web sitesiyle desteklemek mümkün.

Uygun olursanız kısa bir görüşmede nasıl bir yol izleyebileceğimizi paylaşmak isterim.

{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,district,rating,review_count}'),
  ('no_website_en', 'No Website', 'whatsapp', 'website_development', 'friendly_professional', 'en', null,
   $tpl$Hello {{business_name}} team,

I am {{sender_name}} from {{workspace_name}}. While reviewing businesses in {{district}}, I noticed that your Google Business profile does not currently show a website link.

With a {{rating}} rating and {{review_count}} reviews you clearly have strong customer interest. A simple website that brings menu, contact and booking information together could support that interest.

If it is useful, I would be glad to share a short outline of how we could approach it.

{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,district,rating,review_count}'),
  ('weak_mobile_website_tr', 'Zayıf Mobil Web Sitesi', 'email', 'website_development', 'friendly_professional', 'tr', '{{business_name}} web sitesi için kısa bir gözlem',
   $tpl$Merhaba,

Ben {{sender_name}}, {{workspace_name}} ekibinden. {{business_name}} web sitesini incelediğimde mobil cihazlarda bazı geliştirme alanları olduğunu gördüm: {{top_finding}}.

Müşterilerin büyük bölümü işletmeleri telefondan aradığı için mobil deneyim doğrudan iletişim ve rezervasyon akışını etkiliyor.

Dilerseniz gözlemlerimi içeren kısa bir rapor paylaşabilirim: {{report_link}}

İyi çalışmalar,
{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,top_finding,report_link}'),
  ('weak_mobile_website_en', 'Weak Mobile Website', 'email', 'website_development', 'friendly_professional', 'en', 'A short observation about the {{business_name}} website',
   $tpl$Hello,

I am {{sender_name}} from {{workspace_name}}. While reviewing the {{business_name}} website I noticed some improvement areas on mobile devices: {{top_finding}}.

Since most customers look businesses up on their phones, the mobile experience directly affects contact and booking flows.

If helpful, I can share a short report with my observations: {{report_link}}

Kind regards,
{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,top_finding,report_link}'),
  ('google_business_gaps_tr', 'Google İşletme Eksikleri', 'whatsapp', 'google_business', 'friendly_professional', 'tr', null,
   $tpl$Merhaba {{business_name}},

Ben {{sender_name}} ({{workspace_name}}). Google İşletme profilinizi incelerken şu gözlemi yaptım: {{top_finding}}.

Profil bilgileri eksiksiz olduğunda müşteriler işletmeyi haritada daha kolay bulup iletişime geçebiliyor. Bu alanı birlikte hızlıca tamamlayabiliriz.

Kısa bir görüşme için uygun olur musunuz?

{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,top_finding}'),
  ('google_business_gaps_en', 'Google Business Gaps', 'whatsapp', 'google_business', 'friendly_professional', 'en', null,
   $tpl$Hello {{business_name}},

I am {{sender_name}} ({{workspace_name}}). While reviewing your Google Business profile I noticed: {{top_finding}}.

When profile details are complete, customers can find and contact the business more easily on the map. This is something we could complete together quickly.

Would you be open to a short conversation?

{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,top_finding}'),
  ('seo_opportunity_tr', 'SEO Fırsatı', 'email', 'seo', 'friendly_professional', 'tr', '{{business_name}} için arama görünürlüğü notları',
   $tpl$Merhaba,

Ben {{sender_name}}, {{workspace_name}} ekibinden. {{business_name}} web sitesinin arama motorlarındaki görünürlüğüne dair birkaç teknik gözlemim var: {{top_finding}}.

Bu tür eksikler, {{district}} bölgesinde sizi arayan potansiyel müşterilerin sizi bulmasını zorlaştırabilir.

İsterseniz gözlemlerimi içeren raporu inceleyebilirsiniz: {{report_link}}

İyi çalışmalar,
{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,top_finding,district,report_link}'),
  ('seo_opportunity_en', 'SEO Opportunity', 'email', 'seo', 'friendly_professional', 'en', 'Search visibility notes for {{business_name}}',
   $tpl$Hello,

I am {{sender_name}} from {{workspace_name}}. I have a few technical observations about the search visibility of the {{business_name}} website: {{top_finding}}.

Gaps like these can make it harder for potential customers in {{district}} to find you.

You can review the report with my observations here: {{report_link}}

Kind regards,
{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,top_finding,district,report_link}'),
  ('social_media_opportunity_tr', 'Sosyal Medya Fırsatı', 'instagram_dm', 'social_media', 'casual', 'tr', null,
   $tpl$Merhaba {{business_name}} 👋

Ben {{sender_name}}, {{workspace_name}} ekibinden. {{district}} bölgesindeki işletmelerin dijital varlığını incelerken şu gözlemi yaptım: {{top_finding}}.

Düzenli ve tutarlı paylaşımlar, mevcut müşterilerinizle bağı güçlendirmenin en pratik yollarından biri. Uygun olursanız kısa bir fikir alışverişi yapmak isterim.

{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,district,top_finding}'),
  ('social_media_opportunity_en', 'Social Media Opportunity', 'instagram_dm', 'social_media', 'casual', 'en', null,
   $tpl$Hi {{business_name}} 👋

I am {{sender_name}} from {{workspace_name}}. While reviewing the digital presence of businesses in {{district}}, I noticed: {{top_finding}}.

Regular, consistent posting is one of the most practical ways to strengthen the connection with your existing customers. If you are open to it, I would love a quick exchange of ideas.

{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,district,top_finding}'),
  ('review_management_tr', 'Yorum Yönetimi', 'whatsapp', 'review_management', 'friendly_professional', 'tr', null,
   $tpl$Merhaba {{business_name}},

Ben {{sender_name}} ({{workspace_name}}). Google profilinizde {{review_count}} yorum ve {{rating}} puan görüyorum; bu ciddi bir müşteri ilgisi. Gözlemim: {{top_finding}}.

Yorumlara düzenli ve özenli yanıt vermek hem mevcut müşterilerle ilişkiyi güçlendiriyor hem de yeni müşterilere güven veriyor. Bu süreci sizin için yönetebiliriz.

Kısa bir görüşme için uygun olur musunuz?

{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,review_count,rating,top_finding}'),
  ('review_management_en', 'Review Management', 'whatsapp', 'review_management', 'friendly_professional', 'en', null,
   $tpl$Hello {{business_name}},

I am {{sender_name}} ({{workspace_name}}). I see {{review_count}} reviews and a {{rating}} rating on your Google profile, which shows real customer interest. My observation: {{top_finding}}.

Responding to reviews consistently strengthens relationships with existing customers and builds trust with new ones. This is a process we can manage for you.

Would you be open to a short conversation?

{{sender_name}}$tpl$,
   '{business_name,sender_name,workspace_name,review_count,rating,top_finding}'),
  ('gentle_reminder_tr', 'Nazik Hatırlatma', 'whatsapp', null, 'friendly_professional', 'tr', null,
   $tpl$Merhaba {{business_name}},

Geçtiğimiz günlerde {{primary_service}} konusundaki gözlemlerimi paylaşmıştım. Yoğunluğunuzu anlıyorum; uygun bir zamanınız olursa kısa bir görüşme yapmaktan memnuniyet duyarım.

İyi çalışmalar,
{{sender_name}}$tpl$,
   '{business_name,primary_service,sender_name}'),
  ('gentle_reminder_en', 'Gentle Reminder', 'whatsapp', null, 'friendly_professional', 'en', null,
   $tpl$Hello {{business_name}},

A few days ago I shared my observations about {{primary_service}}. I understand you are busy; whenever it suits you, I would be glad to have a short conversation.

Kind regards,
{{sender_name}}$tpl$,
   '{business_name,primary_service,sender_name}'),
  ('digital_visibility_audit_tr', 'Dijital Görünürlük Denetimi', 'email', null, 'formal', 'tr', '{{business_name}} dijital görünürlük denetimi',
   $tpl$Sayın {{business_name}} Yetkilisi,

{{workspace_name}} olarak {{district}}, {{city}} bölgesindeki işletmelerin dijital görünürlüğünü inceliyoruz. {{business_name}} için hazırladığımız denetim özetinde öne çıkan gözlem: {{top_finding}}.

Denetim raporunun tamamına aşağıdaki bağlantıdan ulaşabilirsiniz:
{{report_link}}

Raporu birlikte değerlendirmek isterseniz uygun bir zaman planlayabiliriz.

Saygılarımla,
{{sender_name}}
{{workspace_name}}$tpl$,
   '{business_name,workspace_name,district,city,top_finding,report_link,sender_name}'),
  ('digital_visibility_audit_en', 'Digital Visibility Audit', 'email', null, 'formal', 'en', 'Digital visibility audit for {{business_name}}',
   $tpl$Dear {{business_name}} team,

At {{workspace_name}} we review the digital visibility of businesses in {{district}}, {{city}}. The key observation in the audit summary we prepared for {{business_name}}: {{top_finding}}.

You can access the full audit report here:
{{report_link}}

If you would like to go through the report together, we can schedule a convenient time.

Kind regards,
{{sender_name}}
{{workspace_name}}$tpl$,
   '{business_name,workspace_name,district,city,top_finding,report_link,sender_name}')
)
insert into public.message_templates (scope, key, name, channel, service_id, tone, locale, subject, body, variables, active)
select 'system', t.key, t.name, t.channel::public.message_channel, s.id, t.tone, t.locale, t.subject, t.body, t.variables::text[], true
from t left join public.services s on s.key = t.service_key
on conflict (key) where scope = 'system' do update set
  name = excluded.name, channel = excluded.channel, service_id = excluded.service_id, tone = excluded.tone,
  locale = excluded.locale, subject = excluded.subject, body = excluded.body, variables = excluded.variables, active = true;
