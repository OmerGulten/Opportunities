import type { LeadStatus } from "@/types/common";

/**
 * View models the pipeline pages hand to their client components.
 *
 * Everything that needs the request locale (service names) or a workspace read
 * (owner names) is resolved on the server, so the client renders plain strings
 * and never re-queries.
 */

export interface PipelineStageModel {
  id: string;
  key: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelineOwnerModel {
  id: string;
  name: string;
}

export interface PipelineLeadModel {
  id: string;
  stageId: string;
  status: LeadStatus;
  businessId: string;
  /** Provider-sourced display name; null when no snapshot has been stored yet. */
  businessName: string | null;
  city: string | null;
  district: string | null;
  /** Overall opportunity score, or null when the business has not been scored. */
  overallScore: number | null;
  primaryServiceName: string | null;
  primaryServiceIcon: string | null;
  ownerId: string | null;
  ownerName: string | null;
  estimatedValue: number | null;
  wonValue: number | null;
  currency: string;
  /**
   * Dates arrive pre-formatted for the request locale. Formatting them on the
   * client would depend on the browser time zone and drift from the server
   * render, so the server decides once and the client only prints.
   */
  nextFollowUpLabel: string | null;
  /** Computed on the server so client rendering never depends on `Date.now()`. */
  followUpDue: boolean;
  lastContactedLabel: string | null;
}

export const PIPELINE_VIEWS = ["board", "list"] as const;
export type PipelineView = (typeof PIPELINE_VIEWS)[number];
