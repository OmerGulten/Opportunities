/**
 * Row types for the main tables (snake_case, as returned by supabase-js).
 * The Supabase client is used untyped; cast query results with
 * `.returns<Row[]>()` / `.overrideTypes<Row>()` at the repository boundary.
 */
import type {
  AuditDepth,
  ConfidenceLevel,
  CreditLedgerType,
  EvidenceType,
  Json,
  LeadStatus,
  Locale,
  LocationMethod,
  MessageChannel,
  ObservationStatus,
  ScanStatus,
  WorkspaceRole,
} from "./common";

export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  locale: Locale;
  is_platform_admin: boolean;
  default_workspace_id: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthly_credits: number;
  price_monthly: number;
  currency: string;
  max_members: number;
  features: Record<string, Json>;
  is_default: boolean;
  active: boolean;
  sort_order: number;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan_id: string | null;
  default_locale: Locale;
  default_tone: string;
  sender_name: string | null;
  sender_title: string | null;
  sender_phone: string | null;
  sender_email: string | null;
  company_name: string | null;
  company_website: string | null;
  company_description: string | null;
  brand_primary_color: string | null;
  logo_url: string | null;
  settings: Record<string, Json>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by: string | null;
  joined_at: string;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  key: string;
  name_tr: string;
  name_en: string;
  icon: string | null;
  sort_order: number;
  active: boolean;
}

export interface CategoryProviderMappingRow {
  id: string;
  category_id: string;
  provider: string;
  provider_type: string | null;
  query_text: string | null;
  priority: number;
  active: boolean;
}

export interface ServiceRow {
  id: string;
  key: string;
  name_tr: string;
  name_en: string;
  description_tr: string | null;
  description_en: string | null;
  icon: string | null;
  score_normalizer: number | null;
  sort_order: number;
  active: boolean;
}

export interface ServiceRuleRow {
  id: string;
  service_id: string;
  key: string;
  name_tr: string;
  name_en: string;
  explanation_tr: string | null;
  explanation_en: string | null;
  signal_type: string;
  operator: string;
  value: Json | null;
  points: number;
  min_confidence: ConfidenceLevel;
  requires_depth: AuditDepth;
  active: boolean;
  sort_order: number;
  version: number;
}

export interface CreditPricingRuleRow {
  id: string;
  key: string;
  name: string;
  cost: number;
  unit: "per_business" | "per_message" | "per_report" | "per_scan";
  active: boolean;
}

export interface SystemSettingRow {
  key: string;
  value: Json;
  description: string | null;
  updated_at: string;
}

export interface WorkspaceServiceRow {
  id: string;
  workspace_id: string;
  service_id: string;
  enabled: boolean;
  priority: number;
}

export interface ServiceOfferingRow {
  id: string;
  workspace_id: string;
  service_id: string;
  name: string;
  description: string | null;
  price_from: number | null;
  price_to: number | null;
  currency: string;
  billing_period: "one_time" | "monthly" | "yearly";
  delivery_time: string | null;
  enabled: boolean;
  prompt_context: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PipelineStageRow {
  id: string;
  workspace_id: string;
  key: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
  is_default: boolean;
}

export interface WorkspaceInvitationRow {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface SavedAreaRow {
  id: string;
  workspace_id: string;
  name: string;
  geometry: Json;
  area_km2: number | null;
  created_by: string | null;
  created_at: string;
}

export interface IntegrationRow {
  id: string;
  workspace_id: string;
  type: string;
  status: "inherited" | "enabled" | "disabled";
  config: Record<string, Json>;
  created_at: string;
  updated_at: string;
}

/** Secrets are never stored: only a prefix for display and a sha256 hash. */
export interface ApiKeyRow {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ScanRow {
  id: string;
  workspace_id: string;
  created_by: string | null;
  name: string;
  status: ScanStatus;
  location_method: LocationMethod;
  place_label: string | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
  polygon: Json | null;
  area_km2: number | null;
  audit_depth: AuditDepth;
  filters: Record<string, Json>;
  max_businesses: number;
  estimated_businesses: number;
  estimated_credits: number;
  reserved_credits: number;
  consumed_credits: number;
  refunded_credits: number;
  workflow_run_id: string | null;
  total_targets: number;
  discovered_count: number;
  deduplicated_count: number;
  audited_count: number;
  scored_count: number;
  failed_count: number;
  coverage_metadata: Record<string, Json>;
  is_demo: boolean;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScanTargetRow {
  id: string;
  scan_id: string;
  workspace_id: string;
  cell_index: number;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  category_id: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  results_count: number;
  provider_calls: number;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ScanJobRow {
  id: string;
  scan_id: string;
  workspace_id: string;
  business_id: string | null;
  job_type: "discovery" | "dedupe" | "audit" | "scoring" | "finalize";
  status: "pending" | "running" | "completed" | "failed" | "cancelled" | "skipped";
  attempt: number;
  max_attempts: number;
  idempotency_key: string;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScanJobEventRow {
  id: string;
  scan_id: string;
  workspace_id: string;
  scan_job_id: string | null;
  event_type: string;
  level: "debug" | "info" | "warn" | "error";
  message: string | null;
  metadata: Record<string, Json>;
  created_at: string;
}

export interface ScanBusinessRow {
  id: string;
  scan_id: string;
  business_id: string;
  workspace_id: string;
  matched_category_id: string | null;
  discovery_position: number | null;
  discovered_at: string;
  audit_status: "pending" | "running" | "completed" | "failed" | "skipped";
  opportunity_status: "pending" | "completed" | "failed" | "skipped";
  distance_m: number | null;
  inside_polygon: boolean | null;
}

export interface BusinessRow {
  id: string;
  workspace_id: string;
  provider: string;
  provider_place_id: string;
  normalized_name: string | null;
  canonical_fingerprint: string | null;
  primary_category_id: string | null;
  is_ignored: boolean;
  ignored_at: string | null;
  first_scan_id: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessProviderSnapshotRow {
  id: string;
  business_id: string;
  workspace_id: string;
  provider: string;
  provider_place_id: string;
  display_name: string;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  district: string | null;
  country_code: string | null;
  primary_type: string | null;
  types: string[];
  business_status: string | null;
  rating: number | null;
  user_rating_count: number | null;
  website_uri: string | null;
  phone_national: string | null;
  phone_international: string | null;
  google_maps_uri: string | null;
  opening_hours: Json | null;
  has_opening_hours: boolean | null;
  photo_count: number | null;
  price_level: string | null;
  review_sample: Json | null;
  detail_level: AuditDepth;
  field_mask: string | null;
  fetched_at: string;
  expires_at: string;
  created_at: string;
}

export interface BusinessContactRow {
  id: string;
  business_id: string;
  workspace_id: string;
  type: "phone" | "whatsapp" | "email" | "instagram" | "facebook" | "website" | "other";
  value: string;
  source: "provider" | "website" | "manual" | "derived";
  confidence: ConfidenceLevel;
  is_primary: boolean;
  created_at: string;
}

export interface BusinessAuditRow {
  id: string;
  business_id: string;
  workspace_id: string;
  scan_id: string | null;
  audit_type: "website" | "google_business" | "instagram" | "performance" | "competitor";
  depth: AuditDepth;
  status: "pending" | "running" | "completed" | "failed" | "skipped" | "unavailable";
  observation: ObservationStatus | null;
  summary: Record<string, Json>;
  source: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AuditFindingRow {
  id: string;
  audit_id: string;
  business_id: string;
  workspace_id: string;
  key: string;
  category: string;
  severity: "info" | "low" | "medium" | "high";
  status: ObservationStatus;
  evidence_type: EvidenceType;
  confidence: ConfidenceLevel;
  title: string;
  explanation: string | null;
  why_it_matters: string | null;
  evidence: Record<string, Json>;
  source: string;
  detected_at: string;
  created_at: string;
}

export interface OpportunitySignalRow {
  id: string;
  business_id: string;
  workspace_id: string;
  scan_id: string | null;
  audit_id: string | null;
  signal_type: string;
  source: string;
  status: ObservationStatus;
  evidence_type: EvidenceType;
  confidence: ConfidenceLevel;
  value: Json | null;
  explanation: string | null;
  detected_at: string;
  created_at: string;
}

export interface OpportunityRow {
  id: string;
  business_id: string;
  workspace_id: string;
  scan_id: string | null;
  overall_score: number;
  primary_service_id: string | null;
  secondary_service_ids: string[];
  confidence: ConfidenceLevel;
  status: "calculated" | "stale" | "failed";
  digital_gaps: string[];
  rules_version: number;
  calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunityScoreRow {
  id: string;
  opportunity_id: string;
  business_id: string;
  workspace_id: string;
  service_id: string;
  score: number;
  raw_points: number;
  max_points: number;
  confidence: ConfidenceLevel;
  reasons: Json[];
  unavailable_rules: Json[];
  created_at: string;
}

export interface LeadRow {
  id: string;
  workspace_id: string;
  business_id: string;
  stage_id: string;
  status: LeadStatus;
  owner_id: string | null;
  source_scan_id: string | null;
  primary_service_id: string | null;
  estimated_value: number | null;
  won_value: number | null;
  currency: string;
  loss_reason: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadNoteRow {
  id: string;
  lead_id: string;
  workspace_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface LeadActivityRow {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  business_id: string | null;
  scan_id: string | null;
  actor_id: string | null;
  type: string;
  title: string | null;
  metadata: Record<string, Json>;
  created_at: string;
}

export interface MessageTemplateRow {
  id: string;
  workspace_id: string | null;
  owner_id: string | null;
  scope: "system" | "workspace" | "personal";
  key: string | null;
  name: string;
  channel: MessageChannel;
  service_id: string | null;
  category_id: string | null;
  tone: string;
  locale: Locale;
  subject: string | null;
  body: string;
  variables: string[];
  active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  workspace_id: string;
  business_id: string;
  lead_id: string | null;
  template_id: string | null;
  service_id: string | null;
  generation_id: string | null;
  channel: MessageChannel;
  tone: string | null;
  subject: string | null;
  body: string;
  status: "draft" | "edited" | "copied" | "channel_opened" | "sent_manually" | "archived";
  copied_at: string | null;
  channel_opened_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageGenerationRow {
  id: string;
  workspace_id: string;
  business_id: string | null;
  message_id: string | null;
  provider: string;
  model: string;
  status: "success" | "failed" | "invalid_output" | "unavailable";
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  prompt_version: string | null;
  facts_hash: string | null;
  facts_used: Record<string, Json>;
  error_code: string | null;
  credits_consumed: number;
  created_by: string | null;
  created_at: string;
}

export interface PublicReportRow {
  id: string;
  workspace_id: string;
  business_id: string;
  opportunity_id: string | null;
  token: string;
  title: string;
  locale: Locale;
  content_snapshot: Record<string, Json>;
  branding: Record<string, Json>;
  view_count: number;
  last_viewed_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreditAccountRow {
  id: string;
  workspace_id: string;
  balance: number;
  reserved: number;
  /** Records operations without moving the balance; never fails for want of credits. */
  unlimited: boolean;
  lifetime_granted: number;
  lifetime_consumed: number;
  created_at: string;
  updated_at: string;
}

export interface CreditLedgerRow {
  id: string;
  workspace_id: string;
  account_id: string;
  type: CreditLedgerType;
  amount: number;
  balance_after: number;
  reserved_after: number;
  reference_type: string | null;
  reference_id: string | null;
  idempotency_key: string;
  metadata: Record<string, Json>;
  created_by: string | null;
  created_at: string;
}

export interface CreditReservationRow {
  id: string;
  workspace_id: string;
  account_id: string;
  reference_type: string;
  reference_id: string;
  reserved_amount: number;
  consumed_amount: number;
  refunded_amount: number;
  status: "active" | "settled" | "released";
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: "trialing" | "active" | "past_due" | "cancelled";
  provider: string;
  provider_subscription_id: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  last_grant_period_start: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderCallLogRow {
  id: string;
  workspace_id: string | null;
  scan_id: string | null;
  provider_name: string;
  operation: string;
  duration_ms: number | null;
  success: boolean;
  error_code: string | null;
  estimated_cost: number;
  request_context: Record<string, Json>;
  created_at: string;
}

/** Row of the business_overview view */
export interface BusinessOverviewRow {
  id: string;
  workspace_id: string;
  provider: string;
  provider_place_id: string;
  normalized_name: string;
  primary_category_id: string | null;
  is_ignored: boolean;
  first_scan_id: string | null;
  last_seen_at: string;
  created_at: string;
  snapshot_id: string | null;
  display_name: string | null;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  district: string | null;
  rating: number | null;
  user_rating_count: number | null;
  website_uri: string | null;
  phone_national: string | null;
  google_maps_uri: string | null;
  has_opening_hours: boolean | null;
  photo_count: number | null;
  business_status: string | null;
  snapshot_expires_at: string | null;
  opportunity_id: string | null;
  overall_score: number | null;
  primary_service_id: string | null;
  secondary_service_ids: string[] | null;
  opportunity_confidence: ConfidenceLevel | null;
  digital_gaps: string[] | null;
  calculated_at: string | null;
  website_status: string | null;
  instagram_status: string | null;
  google_completeness: string | null;
  lead_id: string | null;
  stage_id: string | null;
  lead_status: LeadStatus | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
}
