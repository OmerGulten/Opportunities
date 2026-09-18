import type { MessageTree } from "../../config";

/**
 * Owned by the audits module (`src/lib/audits/**`). Mirrors the `tr` file key
 * for key; see it for the structure. Wording stays neutral and factual: an audit
 * reports what was observed, never what the business "failed" to do.
 */
export const findings: MessageTree = {
  // -------------------------------------------------------------------------
  // Website
  // -------------------------------------------------------------------------
  website_not_found: {
    title: "No website found",
    explanation: "The business profile does not carry a website link.",
    why: "A website is the only channel whose content the business controls end to end.",
  },
  website_unreachable: {
    title: "The website did not respond",
    explanation: "{{url}} did not answer during the audit. The site may well be online; this records only this attempt.",
    why: "Visitors may have hit the same problem, so availability is worth watching.",
  },
  website_invalid: {
    title: "The website address could not be used",
    explanation: "{{url}} could not be resolved as a valid public web address.",
    why: "A wrong address on the profile sends visitors to a page that does not open.",
  },
  website_redirected: {
    title: "The address redirected to another domain",
    explanation: "The request was redirected to {{finalUrl}}.",
    why: "The redirect chain shows which domain the brand is actually published on.",
  },
  website_no_https: {
    title: "HTTPS is not used",
    explanation: "The site is served without a secure connection (HTTPS).",
    why: "Browsers label pages without HTTPS as 'not secure'.",
  },
  website_missing_title: {
    title: "No page title",
    explanation: "No title element was found on the homepage.",
    why: "The title is the first line shown in search results.",
  },
  website_weak_title: {
    title: "The page title could be improved",
    explanation: "The title is {{length}} characters and is either generic or outside the suggested length range.",
    why: "Titles of 15-70 characters that name the business and the service read more clearly in search results.",
  },
  website_missing_meta_description: {
    title: "No meta description",
    explanation: "No meta description tag was found on the page.",
    why: "The description sets the text shown under the title in search results.",
  },
  website_weak_meta_description: {
    title: "The meta description could be improved",
    explanation: "The description is {{length}} characters; the suggested range is 50-160.",
    why: "Descriptions that are too short or too long get truncated in search results.",
  },
  website_missing_h1: {
    title: "No H1 heading",
    explanation: "No H1 heading was found on the page.",
    why: "The H1 states the page's main topic to both visitors and search engines.",
  },
  website_heading_structure: {
    title: "The heading structure is uneven",
    explanation: "The page has {{h1}} H1 and {{h2}} H2 headings.",
    why: "A single H1 followed by H2 headings makes the page easier to read.",
  },
  website_missing_viewport: {
    title: "No viewport tag",
    explanation: "No viewport meta tag was found for mobile rendering.",
    why: "Without this tag the page opens at desktop width on a phone.",
  },
  website_missing_canonical: {
    title: "No canonical tag",
    explanation: "No canonical link was found on the page.",
    why: "A canonical tag prevents the same content from competing with itself across addresses.",
  },
  website_missing_schema: {
    title: "No structured data",
    explanation: "No schema.org structured data was found on the page.",
    why: "Structured data lets address, opening hours and ratings appear directly in search results.",
  },
  website_missing_open_graph: {
    title: "No sharing tags",
    explanation: "No Open Graph tags were found on the page.",
    why: "Without them, shared links render with no image and no title.",
  },
  website_missing_favicon: {
    title: "No favicon",
    explanation: "No favicon link is declared on the page.",
    why: "The favicon keeps the brand visible in tabs and bookmarks.",
  },
  website_missing_robots: {
    title: "No robots.txt",
    explanation: "No robots.txt file was found at the domain root.",
    why: "robots.txt steers how search engines crawl the site.",
  },
  website_missing_sitemap: {
    title: "No sitemap",
    explanation: "sitemap.xml was not found and robots.txt declared no sitemap.",
    why: "A sitemap speeds up discovery of the site's pages.",
  },
  website_low_alt_coverage: {
    title: "Images are missing alt text",
    explanation: "{{withAlt}} of {{total}} images have alt text.",
    why: "Alt text describes an image to screen readers and to image search.",
  },
  website_missing_cta: {
    title: "No visible call to action",
    explanation: "No call, booking, reservation or contact prompt was detected in the link and button labels.",
    why: "A call to action tells the visitor what to do next.",
  },
  website_missing_contact_info: {
    title: "No contact information found",
    explanation: "No phone number, email address or postal address was detected on the page.",
    why: "A page without contact details leaves a decided visitor still searching.",
  },
  website_missing_booking: {
    title: "No online booking or reservation flow",
    explanation: "No booking, reservation or online ordering flow was detected on the page.",
    why: "An online flow keeps collecting demand outside opening hours.",
  },
  website_missing_social_links: {
    title: "No social media links",
    explanation: "No link to a social media profile was detected on the page.",
    why: "Links move a site visitor to the channel where content is published regularly.",
  },
  website_not_mobile_friendly: {
    title: "Mobile friendliness looks weak",
    explanation: "This is a heuristic read of the viewport tag and fixed-width layout; no real-device test was run.",
    why: "Most local searches come from mobile devices.",
  },
  website_slow_response: {
    title: "Slow server response",
    explanation: "The homepage responded in {{ms}} ms.",
    why: "Response time is the first component of how fast a page opens.",
  },
  website_thin_content: {
    title: "Little page content",
    explanation: "{{count}} words of text were detected on the homepage.",
    why: "Text describing the services gives context to visitors and to search engines.",
  },
  website_missing_language: {
    title: "No language attribute",
    explanation: "No lang attribute was declared on the html element.",
    why: "The language attribute drives browser translation and accessibility.",
  },
  website_broken_links: {
    title: "Links that did not respond",
    explanation: "{{broken}} of the {{checked}} sampled internal links returned an error.",
    why: "Broken links leave the visitor on an empty page.",
  },
  website_quality_weak: {
    title: "Low website quality score",
    explanation: "The quality score computed from the observed signals is {{score}}/100.",
    why: "The score combines technical, SEO and user-experience observations.",
  },

  // -------------------------------------------------------------------------
  // Google Business Profile
  // -------------------------------------------------------------------------
  google_missing_hours: {
    title: "Opening hours are not shown",
    explanation: "No opening hours were found on the Google profile.",
    why: "A profile without hours cannot answer 'are they open right now?'.",
  },
  google_few_photos: {
    title: "Few photos on the profile",
    explanation: "{{count}} photos are visible on the profile; the comparison threshold is {{target}}. The provider returns at most {{cap}} photos.",
    why: "Photos affect how often a profile is clicked and how often directions are requested.",
  },
  google_missing_phone: {
    title: "No phone number shown",
    explanation: "No phone number was found on the Google profile.",
    why: "The phone is the most used contact route in local search.",
  },
  google_missing_website: {
    title: "No website link shown",
    explanation: "No website link was found on the Google profile.",
    why: "The link moves someone viewing the profile onto the business's own channel.",
  },
  google_low_review_count: {
    title: "Few reviews",
    explanation: "The profile has {{count}} reviews; the comparison threshold is {{target}}.",
    why: "Review count matters for local ranking and for trust.",
  },
  google_low_rating: {
    title: "Low average rating",
    explanation: "The profile is rated {{rating}}; the comparison threshold is {{target}}.",
    why: "The rating directly affects the click decision in search results.",
  },
  google_incomplete_profile: {
    title: "Profile information is incomplete",
    explanation: "The profile completeness score computed from the observed fields is {{score}}/100.",
    why: "Missing fields limit how visible the profile is in local search.",
  },
  google_review_responses_unavailable: {
    title: "Review responses cannot be seen",
    explanation: "The provider in use does not expose owner replies, so the response rate could not be measured.",
    why: "What cannot be measured is not used in scoring.",
  },
  google_low_response_rate: {
    title: "Review response rate looks low",
    explanation: "{{rate}}% of the {{size}} sampled reviews showed an owner reply. The sample is small, so this observation is low confidence.",
    why: "Answered reviews show new customers that the business is paying attention.",
  },
  google_not_operational: {
    title: "The profile is not marked operational",
    explanation: "The Google profile reports the business status as {{status}}.",
    why: "This should be verified before reaching out.",
  },

  // -------------------------------------------------------------------------
  // Instagram
  // -------------------------------------------------------------------------
  instagram_not_found: {
    title: "No Instagram profile found",
    explanation: "No Instagram profile was found in the sources checked (provider profile data and website links).",
    why: "A profile may exist under another name; this finding covers only the sources checked.",
  },
  instagram_ambiguous: {
    title: "The Instagram profile is ambiguous",
    explanation: "More than one Instagram handle was linked from the website, and none could be matched to the business with confidence.",
    why: "Until the match is clear this area is left out of scoring.",
  },
  instagram_not_checked: {
    title: "Instagram was not checked",
    explanation: "Instagram discovery did not run at this scan depth or with these settings.",
    why: "Something that was not checked is never reported as missing.",
  },
  instagram_activity_unavailable: {
    title: "Instagram activity was not measured",
    explanation: "Profile content (posting frequency, followers, bio) is not read in this version.",
    why: "Only observed data is reported.",
  },

  // -------------------------------------------------------------------------
  // Performance
  // -------------------------------------------------------------------------
  performance_poor_mobile: {
    title: "Low mobile performance",
    explanation: "The mobile performance score is {{score}}/100 ({{method}}).",
    why: "Slow pages lose part of their visitors before the page appears.",
  },
  performance_needs_improvement: {
    title: "Mobile performance could improve",
    explanation: "The mobile performance score is {{score}}/100 ({{method}}).",
    why: "Raising the score directly improves the first-load experience.",
  },

  // -------------------------------------------------------------------------
  // Branding
  // -------------------------------------------------------------------------
  branding_missing_logo: {
    title: "No logo signal found",
    explanation: "No logo image or share image was detected on the page.",
    why: "The logo is the first visual element that identifies the brand.",
  },
  branding_name_inconsistent: {
    title: "The business name does not match the page",
    explanation: "The business name was not recognisable in the page title or the main heading.",
    why: "Using the same name on every channel makes it easier to match in search results.",
  },
  branding_low_consistency: {
    title: "Low brand consistency",
    explanation: "The heuristic score computed from logo, favicon, sharing tags and name match is {{score}}/100.",
    why: "A consistent visual identity shows that touchpoints on different channels belong to the same brand.",
  },

  // -------------------------------------------------------------------------
  // Signal explanations
  // -------------------------------------------------------------------------
  signal: {
    website_status: "Website status: {{value}}.",
    website_url: "Audited web address: {{value}}.",
    website_quality: "Website quality derived from the observations: {{value}}.",
    website_quality_score: "Website quality score: {{value}}/100.",
    website_https: "Secure connection (HTTPS): {{value}}.",
    website_response_time_ms: "Homepage response time: {{value}} ms.",
    website_status_code: "HTTP status code: {{value}}.",
    website_has_meta_title: "Page title present: {{value}}.",
    website_title_quality: "Title assessment: {{value}} ({{length}} characters).",
    website_has_meta_description: "Meta description present: {{value}}.",
    website_description_quality: "Meta description assessment: {{value}} ({{length}} characters).",
    website_has_h1: "H1 heading present: {{value}} ({{count}} found).",
    website_heading_structure_ok: "Heading structure sound: {{value}} (H1: {{h1}}, H2: {{h2}}).",
    website_has_viewport: "Viewport tag present: {{value}}.",
    website_has_canonical: "Canonical tag present: {{value}}.",
    website_has_schema: "Structured data present: {{value}} ({{types}}).",
    website_has_open_graph: "Open Graph tags present: {{value}}.",
    website_has_favicon: "Favicon present: {{value}}.",
    website_has_sitemap: "sitemap.xml found: {{value}}.",
    website_has_robots: "robots.txt found: {{value}}.",
    website_image_alt_coverage: "Alt text coverage: {{value}} ({{withAlt}} of {{total}} images have alt text).",
    website_has_cta: "Call to action detected: {{value}} ({{samples}}).",
    website_has_contact_info: "Contact information detected: {{value}}.",
    website_has_phone: "Phone number detected on the page: {{value}}.",
    website_has_address: "Address detected on the page: {{value}}.",
    website_has_opening_hours: "Opening hours detected on the page: {{value}}.",
    website_has_booking: "Booking or reservation flow detected: {{value}}.",
    website_has_menu: "Menu page detected: {{value}}.",
    website_has_whatsapp: "WhatsApp link detected: {{value}}.",
    website_has_social_links: "Social media links present: {{value}} ({{count}} links).",
    website_mobile_friendly: "Heuristic mobile friendliness assessment: {{value}}.",
    website_language_declared: "HTML language attribute declared: {{value}} ({{lang}}).",
    website_broken_links_count: "Links that did not respond: {{value}} ({{checked}} links checked).",
    performance_mobile_score: "Mobile performance score: {{value}} ({{method}}).",
    performance_desktop_score: "Desktop performance score: {{value}} ({{method}}).",
    performance_lcp_ms: "Largest contentful paint (LCP): {{value}} ms ({{method}}).",
    performance_cls: "Cumulative layout shift (CLS): {{value}} ({{method}}).",
    performance_inp_ms: "Interaction to next paint (INP): {{value}} ms ({{method}}).",
    performance_mobile_grade: "Mobile performance grade: {{value}} ({{method}}).",
    instagram_status: "Instagram status: {{value}}.",
    instagram_profile_url: "Instagram profile address: {{value}}.",
    instagram_days_since_last_post: "Days since the last post: {{value}}.",
    instagram_is_active: "Profile active: {{value}}.",
    instagram_has_website_link: "Website link on the profile: {{value}}.",
    instagram_bio_complete: "Profile bio complete: {{value}}.",
    instagram_follower_count: "Follower count: {{value}}.",
    google_rating: "Google rating: {{value}}.",
    google_review_count: "Google review count: {{value}}.",
    google_has_opening_hours: "Opening hours on the profile: {{value}}.",
    google_photo_count: "Photos on the profile: {{value}} (the provider returns at most {{cap}} photos).",
    google_has_website: "Website link on the profile: {{value}}.",
    google_has_phone: "Phone number on the profile: {{value}}.",
    google_business_status: "Google business status: {{value}}.",
    google_profile_completeness: "Profile completeness: {{value}}.",
    google_completeness_score: "Profile completeness score: {{value}}/100.",
    google_review_response_rate: "{{withReply}} of the {{size}} sampled reviews had an owner reply; rate {{value}}.",
    google_recent_unanswered_reviews: "Reviews left unanswered in the last {{days}} days: {{value}} (sample of {{size}}).",
    google_review_sample_size: "Review sample examined: {{value}} reviews.",
    branding_has_logo_signal: "Logo signal detected: {{value}}.",
    branding_name_consistency: "Business name matches the page: {{value}}.",
    branding_consistency_score: "Heuristic brand consistency score: {{value}}/100.",
  },

  // -------------------------------------------------------------------------
  // Why a signal could not be established
  // -------------------------------------------------------------------------
  unavailable: {
    website_not_found: "This check did not run because the business has no website.",
    website_not_reachable: "This check could not run because the website did not respond.",
    website_invalid: "This check could not run because the web address could not be used.",
    website_not_audited: "This check did not run because the website was not audited.",
    website_discovery_depth: "This check did not run because the website is not opened at discovery depth.",
    robots_not_checked: "robots.txt and the sitemap were not checked in this scan.",
    broken_links_not_checked: "Link checking did not run in this scan.",
    google_field_not_requested: "This field is unknown because it was not requested from the provider.",
    google_no_owner_replies: "The provider does not expose owner replies.",
    instagram_not_fetched: "This was not read because the Instagram profile is never opened.",
    instagram_not_checked: "This was not read because no Instagram profile could be identified.",
    performance_not_run: "The performance measurement did not run in this scan.",
    performance_no_website: "Performance was not measured because there is no auditable website.",
    performance_metric_unavailable: "This metric is not reported by {{source}}.",
    audit_failed: "This could not be obtained because the audit failed.",
  },

  // -------------------------------------------------------------------------
  // Shared words
  // -------------------------------------------------------------------------
  value: {
    yes: "yes",
    no: "no",
    unknown: "unknown",
    weak: "weak",
    average: "average",
    strong: "strong",
  },
  method: {
    heuristic: "heuristic estimate, not a Lighthouse score",
    measured: "PageSpeed measurement",
  },
  note: {
    instagram_from_provider: "The profile came from the place provider's data.",
    instagram_from_website: "The profile link was found on the website.",
    instagram_handle_matches_name: "The profile link was found on the website and the handle matches the business name.",
    instagram_multiple_candidates: "More than one handle was linked from the website: {{candidates}}.",
    instagram_website_not_audited: "Instagram discovery could not run because the website was not audited.",
    instagram_other_socials_only: "The website links to other social networks but not to Instagram.",
    instagram_no_socials: "No social media link of any kind was found on the website.",
    instagram_profile_not_fetched: "The Instagram profile was not opened; posts, followers and bio were not read.",
  },
  benchmark: {
    competitor_label: "Competitor {{letter}}",
    has_website: "{{count}} of the {{total}} compared businesses have a website link on their profile. This business: {{current}}.",
    has_instagram: "An Instagram profile was found for {{count}} of the {{total}} compared businesses. This business: {{current}}.",
    has_opening_hours: "{{count}} of the {{total}} compared businesses show opening hours on their profile. This business: {{current}}.",
    rating: "This business is rated {{current}}. Across the {{total}} compared businesses ratings range from {{min}} to {{max}}, median {{median}}.",
    review_count: "This business has {{current}} reviews. Across the {{total}} compared businesses review counts range from {{min}} to {{max}}, median {{median}}.",
    photo_count: "This business has {{current}} photos. Across the {{total}} compared businesses photo counts range from {{min}} to {{max}}, median {{median}}.",
    website_quality: "Website quality across the {{total}} compared businesses: {{weak}} weak, {{average}} average, {{strong}} strong. This business: {{current}}.",
  },
};
