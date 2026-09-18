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
    headline: "This report summarises observations of {{business}}'s publicly visible digital presence and contains {{count}} finding(s).",
    ctaHeading: "Let's go through the findings together",
    ctaBody: "The {{workspace}} team is happy to talk through the observations listed here and help prioritise the next steps.",
    disclaimer:
      "This report is based on observations collected automatically from publicly available sources on the date it was produced. Items that could not be checked are marked explicitly as \"not checked\"; that does not mean the feature is absent. The content is informational, may change over time and guarantees no particular outcome.",
  },

  public: {
    documentTitle: "Digital presence report",
    metaDescription: "A link-shared digital presence report compiled from publicly available sources.",
    preparedBy: "Prepared by {{workspace}}",
    generatedAt: "Report date: {{date}}",
    print: "Print or save as PDF",
    printHint: "This page is print friendly.",

    business: {
      title: "Business",
      category: "Category",
      location: "Location",
      address: "Address",
      rating: "Rating",
      reviews: "Reviews",
      ratingValue: "{{rating}} / 5",
      website: "Website",
      instagram: "Instagram",
      maps: "Map listing",
      openMaps: "Open the map listing",
      openWebsite: "Open the website",
      unknown: "Not stated",
    },

    summary: {
      title: "Opportunity summary",
      description: "The score is computed from the findings below. It reflects the density of observed gaps, not a likelihood of purchase.",
      scoreCaption: "Overall",
      notScored: "Not scored",
      notScoredHint: "No overall score has been calculated for this business yet.",
      primaryService: "Leading service area",
      confidence: "Overall confidence",
      gapsTitle: "Observed digital gaps",
      gapsEmpty: "No digital gap was observed.",
    },

    findings: {
      title: "Findings",
      description: "Each finding is listed with the evidence type that shows how it was obtained and with its confidence level.",
      whyItMatters: "Why it matters",
      empty: "This report lists no findings.",
      emptyHint: "There was no shareable finding on record when the report was produced.",
    },

    services: {
      title: "Opportunity score per service",
      description: "Each score states plainly which observations it is built from and which checks could not be run.",
      reasons: "Observations contributing to the score",
      reasonPoints: "+{{points}}",
      noReasons: "No contributing observation was recorded for this service.",
      notChecked: "Checks that could not be run",
      notCheckedHint: "These items could not be checked. That does not mean they are missing, and they are not part of the score.",
      empty: "No per-service score was calculated.",
    },

    recommendations: {
      title: "Suggested work",
      description: "Service packages that correspond to the findings, with their price ranges.",
      priceRange: "{{from}} – {{to}}",
      priceFrom: "from {{from}}",
      priceTo: "up to {{to}}",
      priceUnknown: "Price on request",
      delivery: "Delivery time: {{time}}",
      billing: {
        one_time: "One time",
        monthly: "Monthly",
        yearly: "Yearly",
      },
      empty: "No service suggestion was attached to this report.",
    },

    contact: {
      title: "Contact",
      email: "Email",
      phone: "Phone",
      website: "Website",
    },

    disclaimerTitle: "About this report",
    attributionTitle: "Data source",

    states: {
      notFoundTitle: "Report not found",
      notFoundDescription: "This link does not point to a report. You can check the address with whoever sent it.",
      inactiveTitle: "This link is no longer active",
      inactiveDescription: "The report link was turned off or has expired. Contact the person who shared it if you need an up-to-date report.",
      errorTitle: "The report could not be shown",
      errorDescription: "Something unexpected happened while loading the report. You can try again.",
      retry: "Try again",
    },
  },

  gaps: {
    no_website: "No website found",
    weak_website: "Thin website content",
    no_https: "No secure connection (HTTPS)",
    no_instagram: "No Instagram account found",
    inactive_instagram: "Instagram account not updated recently",
    google_incomplete: "Incomplete map profile",
    low_reviews: "Few reviews",
    low_rating: "Low average rating",
    missing_hours: "Opening hours not filled in",
    few_photos: "Few photos",
    slow_mobile: "Slow on mobile",
    unanswered_reviews: "Unanswered reviews",
  },
};
