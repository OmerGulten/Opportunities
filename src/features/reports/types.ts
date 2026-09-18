import type { ConfidenceLevel, EvidenceType, Locale, ObservationStatus } from "@/types/common";

/**
 * The exact shape stored in `public_reports.content_snapshot` and rendered at
 * /report/[token].
 *
 * This is an allow-list, not a projection of the business record: anything not
 * declared here never reaches a public page. Private CRM data (notes, lead
 * stage, owner, estimated value, activity history), internal scoring rules,
 * raw provider payloads and any credential are deliberately absent.
 *
 * The snapshot is frozen at creation time so a shared link keeps saying what the
 * sender saw, and it carries its own attribution requirements.
 */
export const REPORT_SNAPSHOT_VERSION = 1;

export interface ReportFinding {
  key: string;
  title: string;
  explanation: string | null;
  whyItMatters: string | null;
  severity: "info" | "low" | "medium" | "high";
  status: ObservationStatus;
  evidenceType: EvidenceType;
  confidence: ConfidenceLevel;
}

export interface ReportServiceOpportunity {
  serviceKey: string;
  serviceLabel: string;
  score: number;
  confidence: ConfidenceLevel;
  /** Localized rule names with their points, so the score is explainable. */
  reasons: Array<{ label: string; points: number; evidenceType: EvidenceType }>;
  /** Checks that could not be run, shown so the reader is not misled. */
  notChecked: string[];
}

export interface ReportRecommendation {
  serviceKey: string;
  serviceLabel: string;
  offeringName: string | null;
  description: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
  billingPeriod: string | null;
  deliveryTime: string | null;
}

export interface ReportBranding {
  workspaceName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  senderName: string | null;
  senderTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  companyWebsite: string | null;
}

export interface ReportSnapshot {
  version: number;
  locale: Locale;
  generatedAt: string;
  business: {
    name: string;
    categoryLabel: string | null;
    city: string | null;
    district: string | null;
    address: string | null;
    rating: number | null;
    reviewCount: number | null;
    websiteStatus: ObservationStatus | string;
    websiteUrl: string | null;
    instagramStatus: ObservationStatus | string;
    mapsUrl: string | null;
  };
  summary: {
    overallScore: number | null;
    primaryServiceKey: string | null;
    primaryServiceLabel: string | null;
    confidence: ConfidenceLevel | null;
    digitalGaps: string[];
    /** Neutral 1-2 sentence description, never a sales claim. */
    headline: string;
  };
  findings: ReportFinding[];
  serviceOpportunities: ReportServiceOpportunity[];
  recommendations: ReportRecommendation[];
  callToAction: {
    heading: string;
    body: string;
  } | null;
  attribution: {
    provider: string;
    required: boolean;
    text: string;
  };
  /** Shown verbatim so the reader knows what the report is and is not. */
  disclaimer: string;
}
