import type { MessageTree } from "../../config";

/** Owned by the public marketing pages (landing + shared header/footer). */
export const marketing: MessageTree = {
  nav: {
    howItWorks: "How it works",
    scoring: "Scoring",
    principles: "Principles",
    pricing: "Plans",
  },
  hero: {
    eyebrow: "Local business opportunity engine",
    title: "Find the businesses that match the service you sell",
    titleAccent: "with observable evidence",
    subtitle:
      "OpportunityOS discovers local businesses in an area, audits their digital presence and produces a separate, explained opportunity score for each service you offer. Then it drafts a fact-bound message for you to send.",
    ctaPrimary: "Start for free",
    ctaSecondary: "See how it works",
    ctaDashboard: "Go to dashboard",
    note: "Start on the free plan. No card required.",
    highlights: {
      h1: "Pick an area: a place, a radius or a drawn polygon",
      h2: "Service-specific scoring, explained rule by rule",
      h3: "Messages stay drafts; you send them yourself",
    },
  },
  loop: {
    title: "One loop: discover, audit, see the opportunity, reach out, follow up",
    description: "Every step carries evidence into the next one. No step invents a prediction.",
    steps: {
      s1: { title: "Discover", description: "Pick an area and categories from the map provider to list businesses; duplicates are merged." },
      s2: { title: "Audit", description: "Google Business Profile, website and social presence are checked with explicit status codes." },
      s3: { title: "See the opportunity", description: "Signals meet service rules, producing a separate, explainable score per service." },
      s4: { title: "Reach out", description: "WhatsApp, email or Instagram drafts are generated from verified facts only." },
      s5: { title: "Follow up", description: "Move leads through New, Contacted, Replied, Meeting, Proposal, Won and Lost." },
    },
  },
  scoring: {
    title: "Not one “quality score” — a score per service",
    description:
      "A business is not simply “has a website or not”. Each service you sell gets an independent opportunity score with its matched rules and evidence types, so you know which offer to lead with.",
    bullets: {
      b1: "Every score is the normalised sum of the rules that matched.",
      b2: "Every rule states which signal it came from and how many points it added.",
      b3: "Anything that could not be checked stays “not checked” and is never counted as zero.",
    },
    example: {
      label: "Illustrative view",
      businessName: "Example Hair & Beauty",
      businessMeta: "Kadıköy, Istanbul · Hair salon",
      primaryLabel: "Primary opportunity",
      secondaryLabel: "Other services",
      evidenceTitle: "Observations behind this score",
      e1: "No website URL was found on the business profile",
      e2: "Unanswered reviews were observed in the last 12 months",
      e3: "No Instagram account could be identified",
      disclaimer: "This card is a fictional example and does not represent a real business.",
      services: {
        website_development: "Website Development",
        review_management: "Review Management",
        social_media: "Social Media Management",
        seo: "SEO",
      },
    },
  },
  honesty: {
    title: "Data honesty is the product",
    description: "Your pitch is only as solid as the data behind it, so the product never invents a fact.",
    items: {
      i1: { title: "Explicit statuses", description: "Found, not found, not checked, unavailable, error and ambiguous are shown separately. “Not checked” is never presented as “not found”." },
      i2: { title: "Labelled evidence", description: "Every finding is marked observed, derived, heuristic or unavailable. Heuristic measurements say so." },
      i3: { title: "No predictions", description: "No purchase probability, no close score. Only observable gaps are reported." },
      i4: { title: "Coverage is stated", description: "Provider results are not an exhaustive census of every business in the area, and the interface says so." },
    },
  },
  pricing: {
    title: "Credits that follow your usage",
    description: "Scans and AI drafts spend credits. Every plan includes a monthly grant.",
    perMonth: "/mo",
    creditsPerMonth: "{{count}} credits per month",
    membersIncluded: "{{count}} members",
    free: "Free",
    cta: "Start on this plan",
    unavailable: "The plan list cannot be shown right now. Create an account on the free plan to see current plans inside the app.",
    note: "Payment processing is disabled in this release; plans are managed inside the app.",
  },
  cta: {
    title: "Run your first scan in your area today",
    description: "Create an account, pick your services and see your first opportunity list.",
    primary: "Create a free account",
    secondary: "Sign in",
  },
  footer: {
    tagline: "Match the observable digital gaps of local businesses to the services you sell.",
    product: "Product",
    legalTitle: "Legal",
    attribution: "Map and business data comes from Google Maps Platform and is displayed under the provider's terms.",
    copyright: "© {{year}} OpportunityOS",
  },
  cookies: {
    title: "About cookies",
    description: "This app only uses essential cookies for your session, language and interface preference. There are no advertising or third-party tracking cookies.",
    accept: "Got it",
    details: "Details",
  },
};
