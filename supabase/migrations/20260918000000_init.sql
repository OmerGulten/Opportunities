-- ============================================================================
-- OpportunityOS — initial schema
-- Multi-tenant lead discovery, auditing, opportunity scoring, outreach, pipeline.
-- Conventions: uuid PKs, timestamptz, updated_at trigger, RLS on every table.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Enums (state machines only; descriptive categories use text + check)
-- ----------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'member');

create type public.scan_status as enum (
  'created', 'queued', 'discovering', 'deduplicating', 'enriching', 'auditing',
  'scoring', 'completed', 'partially_completed', 'failed', 'cancelled'
);

create type public.credit_ledger_type as enum (
  'monthly_grant', 'purchase', 'reservation', 'consumption', 'refund',
  'admin_adjustment', 'expiration'
);

create type public.audit_depth as enum ('discovery', 'basic', 'deep');
create type public.location_method as enum ('place', 'radius', 'polygon');
create type public.lead_status as enum ('open', 'won', 'lost', 'archived');
create type public.message_channel as enum ('whatsapp', 'email', 'instagram_dm');

-- Observability statuses used across audits and signals
create type public.observation_status as enum (
  'found', 'not_found', 'not_checked', 'unavailable', 'error', 'ambiguous'
);
create type public.evidence_type as enum ('observed', 'derived', 'heuristic', 'unavailable');
create type public.confidence_level as enum ('high', 'medium', 'low');

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- Identity & tenancy
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  is_platform_admin boolean not null default false,
  default_workspace_id uuid,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  monthly_credits integer not null default 0,
  price_monthly numeric(12,2) not null default 0,
  currency text not null default 'TRY',
  max_members integer not null default 1,
  features jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_plans_updated before update on public.plans
  for each row execute function public.set_updated_at();

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete restrict,
  plan_id uuid references public.plans(id),
  default_locale text not null default 'tr' check (default_locale in ('tr', 'en')),
  default_tone text not null default 'friendly_professional',
  sender_name text,
  sender_title text,
  sender_phone text,
  sender_email text,
  company_name text,
  company_website text,
  company_description text,
  brand_primary_color text,
  logo_url text,
  settings jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_workspaces_owner on public.workspaces(owner_id);
create trigger trg_workspaces_updated before update on public.workspaces
  for each row execute function public.set_updated_at();

alter table public.profiles
  add constraint profiles_default_workspace_fk
  foreign key (default_workspace_id) references public.workspaces(id) on delete set null;

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  invited_by uuid references auth.users(id),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index idx_workspace_members_user on public.workspace_members(user_id);
create index idx_workspace_members_workspace on public.workspace_members(workspace_id);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'member',
  token text not null unique,
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_workspace_invitations_workspace on public.workspace_invitations(workspace_id);

-- ----------------------------------------------------------------------------
-- Reference data
-- ----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_tr text not null,
  name_en text not null,
  icon text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_categories_updated before update on public.categories
  for each row execute function public.set_updated_at();

create table public.category_provider_mappings (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  provider text not null,
  provider_type text,            -- e.g. Google place type "restaurant"
  query_text text,               -- optional text-search query
  priority integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category_id, provider, provider_type, query_text)
);
create index idx_cpm_category on public.category_provider_mappings(category_id);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_tr text not null,
  name_en text not null,
  description_tr text,
  description_en text,
  icon text,
  -- Raw points that map to 100. Null => sum of active rule points.
  score_normalizer integer,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_services_updated before update on public.services
  for each row execute function public.set_updated_at();

create table public.service_rules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  key text not null,
  name_tr text not null,
  name_en text not null,
  explanation_tr text,
  explanation_en text,
  signal_type text not null,
  operator text not null check (operator in (
    'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'not_in', 'exists', 'not_exists', 'between', 'is_true', 'is_false'
  )),
  value jsonb,
  points integer not null,
  -- Minimum confidence of the signal for the rule to apply
  min_confidence public.confidence_level not null default 'low',
  -- Which audit depth is required for this rule to be evaluable
  requires_depth public.audit_depth not null default 'discovery',
  active boolean not null default true,
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, key)
);
create index idx_service_rules_service on public.service_rules(service_id);
create index idx_service_rules_signal on public.service_rules(signal_type);
create trigger trg_service_rules_updated before update on public.service_rules
  for each row execute function public.set_updated_at();

create table public.credit_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,   -- discovery, basic_audit, deep_audit, ai_message, report, competitor_benchmark
  name text not null,
  cost integer not null check (cost >= 0),
  unit text not null default 'per_business' check (unit in ('per_business', 'per_message', 'per_report', 'per_scan')),
  active boolean not null default true,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_credit_pricing_rules_updated before update on public.credit_pricing_rules
  for each row execute function public.set_updated_at();

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Workspace configuration
-- ----------------------------------------------------------------------------
create table public.workspace_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  enabled boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, service_id)
);
create index idx_workspace_services_workspace on public.workspace_services(workspace_id);

create table public.service_offerings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  name text not null,
  description text,
  price_from numeric(12,2),
  price_to numeric(12,2),
  currency text not null default 'TRY',
  billing_period text not null default 'one_time' check (billing_period in ('one_time', 'monthly', 'yearly')),
  delivery_time text,
  enabled boolean not null default true,
  prompt_context text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_service_offerings_workspace on public.service_offerings(workspace_id);
create index idx_service_offerings_service on public.service_offerings(service_id);
create trigger trg_service_offerings_updated before update on public.service_offerings
  for each row execute function public.set_updated_at();

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null,
  name text not null,
  color text,
  sort_order integer not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, key)
);
create index idx_pipeline_stages_workspace on public.pipeline_stages(workspace_id);

create table public.saved_areas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  geometry jsonb not null,         -- GeoJSON Polygon
  area_km2 numeric(12,4),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_saved_areas_workspace on public.saved_areas(workspace_id);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null,              -- google_places, openai, pagespeed, ...
  status text not null default 'inherited' check (status in ('inherited', 'enabled', 'disabled')),
  config jsonb not null default '{}'::jsonb,   -- non-secret settings only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, type)
);
create trigger trg_integrations_updated before update on public.integrations
  for each row execute function public.set_updated_at();

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_api_keys_workspace on public.api_keys(workspace_id);

-- ----------------------------------------------------------------------------
-- Scans
-- ----------------------------------------------------------------------------
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id),
  name text not null,
  status public.scan_status not null default 'created',
  location_method public.location_method not null,
  place_label text,
  center_lat double precision,
  center_lng double precision,
  radius_m integer,
  polygon jsonb,                   -- GeoJSON Polygon
  area_km2 numeric(12,4),
  audit_depth public.audit_depth not null default 'basic',
  filters jsonb not null default '{}'::jsonb,
  max_businesses integer not null default 100,
  estimated_businesses integer not null default 0,
  estimated_credits integer not null default 0,
  reserved_credits integer not null default 0,
  consumed_credits integer not null default 0,
  refunded_credits integer not null default 0,
  workflow_run_id text,
  total_targets integer not null default 0,
  discovered_count integer not null default 0,
  deduplicated_count integer not null default 0,
  audited_count integer not null default 0,
  scored_count integer not null default 0,
  failed_count integer not null default 0,
  coverage_metadata jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_scans_workspace on public.scans(workspace_id, created_at desc);
create index idx_scans_status on public.scans(status);
create index idx_scans_workflow_run on public.scans(workflow_run_id);
create trigger trg_scans_updated before update on public.scans
  for each row execute function public.set_updated_at();

create table public.scan_categories (
  scan_id uuid not null references public.scans(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  primary key (scan_id, category_id)
);

create table public.scan_services (
  scan_id uuid not null references public.scans(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  primary key (scan_id, service_id)
);

create table public.scan_targets (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  cell_index integer not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m integer not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  results_count integer not null default 0,
  provider_calls integer not null default 0,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (scan_id, cell_index, category_id)
);
create index idx_scan_targets_scan on public.scan_targets(scan_id);

create table public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_id uuid,
  job_type text not null check (job_type in ('discovery', 'dedupe', 'audit', 'scoring', 'finalize')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled', 'skipped')),
  attempt integer not null default 0,
  max_attempts integer not null default 3,
  idempotency_key text not null unique,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_scan_jobs_scan on public.scan_jobs(scan_id, status);
create index idx_scan_jobs_business on public.scan_jobs(business_id);
create trigger trg_scan_jobs_updated before update on public.scan_jobs
  for each row execute function public.set_updated_at();

create table public.scan_job_events (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scan_job_id uuid references public.scan_jobs(id) on delete set null,
  event_type text not null,
  level text not null default 'info' check (level in ('debug', 'info', 'warn', 'error')),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_scan_job_events_scan on public.scan_job_events(scan_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Businesses (identity separated from provider data and CRM data)
-- ----------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  provider_place_id text not null,
  normalized_name text not null,
  canonical_fingerprint text not null,
  primary_category_id uuid references public.categories(id),
  is_ignored boolean not null default false,
  ignored_at timestamptz,
  first_scan_id uuid references public.scans(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_place_id)
);
create index idx_businesses_workspace on public.businesses(workspace_id);
create index idx_businesses_fingerprint on public.businesses(workspace_id, canonical_fingerprint);
create index idx_businesses_place on public.businesses(provider_place_id);
create trigger trg_businesses_updated before update on public.businesses
  for each row execute function public.set_updated_at();

alter table public.scan_jobs
  add constraint scan_jobs_business_fk foreign key (business_id) references public.businesses(id) on delete cascade;

-- Scan membership (why a business appeared in a scan). Identity stays in businesses.
create table public.scan_businesses (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  matched_category_id uuid references public.categories(id),
  discovery_position integer,
  discovered_at timestamptz not null default now(),
  audit_status text not null default 'pending' check (audit_status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  opportunity_status text not null default 'pending' check (opportunity_status in ('pending', 'completed', 'failed', 'skipped')),
  distance_m integer,
  inside_polygon boolean,
  unique (scan_id, business_id)
);
create index idx_scan_businesses_scan on public.scan_businesses(scan_id, audit_status);
create index idx_scan_businesses_business on public.scan_businesses(business_id);
create index idx_scan_businesses_workspace on public.scan_businesses(workspace_id);

create table public.business_provider_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  provider_place_id text not null,
  display_name text not null,
  formatted_address text,
  lat double precision,
  lng double precision,
  city text,
  district text,
  country_code text,
  primary_type text,
  types text[] not null default '{}',
  business_status text,
  rating numeric(3,2),
  user_rating_count integer,
  website_uri text,
  phone_national text,
  phone_international text,
  google_maps_uri text,
  opening_hours jsonb,             -- { weekdayDescriptions: [], periods: [] } subset
  has_opening_hours boolean,
  photo_count integer,
  price_level text,
  review_sample jsonb,             -- small sample: [{ rating, relativeTime, hasOwnerReply }]
  detail_level text not null default 'discovery' check (detail_level in ('discovery', 'basic', 'deep')),
  field_mask text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_bps_business on public.business_provider_snapshots(business_id, fetched_at desc);
create index idx_bps_workspace on public.business_provider_snapshots(workspace_id);
create index idx_bps_expires on public.business_provider_snapshots(expires_at);

create table public.business_contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null check (type in ('phone', 'whatsapp', 'email', 'instagram', 'facebook', 'website', 'other')),
  value text not null,
  source text not null check (source in ('provider', 'website', 'manual', 'derived')),
  confidence public.confidence_level not null default 'medium',
  is_primary boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (business_id, type, value)
);
create index idx_business_contacts_business on public.business_contacts(business_id);

create table public.business_audits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  audit_type text not null check (audit_type in ('website', 'google_business', 'instagram', 'performance', 'competitor')),
  depth public.audit_depth not null default 'basic',
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'skipped', 'unavailable')),
  observation public.observation_status,      -- for website/instagram: found / not_found / ...
  summary jsonb not null default '{}'::jsonb, -- typed per audit_type (see src/types/audits.ts)
  source text,                                -- pagespeed | heuristic | provider | website | ...
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);
create index idx_business_audits_business on public.business_audits(business_id, audit_type, created_at desc);
create index idx_business_audits_scan on public.business_audits(scan_id);
create index idx_business_audits_workspace on public.business_audits(workspace_id);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.business_audits(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null,                 -- e.g. website.missing_meta_description
  category text not null check (category in ('technical', 'seo', 'performance', 'ux', 'social', 'google', 'branding', 'general')),
  severity text not null default 'medium' check (severity in ('info', 'low', 'medium', 'high')),
  status public.observation_status not null default 'found',
  evidence_type public.evidence_type not null default 'observed',
  confidence public.confidence_level not null default 'medium',
  title text not null,
  explanation text,
  why_it_matters text,
  evidence jsonb not null default '{}'::jsonb,
  source text not null,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_audit_findings_audit on public.audit_findings(audit_id);
create index idx_audit_findings_business on public.audit_findings(business_id);
create index idx_audit_findings_key on public.audit_findings(key);

create table public.opportunity_signals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  audit_id uuid references public.business_audits(id) on delete set null,
  signal_type text not null,         -- e.g. website.status, google.has_opening_hours
  source text not null,              -- provider | website_audit | google_audit | instagram_audit | performance | derived | heuristic
  status public.observation_status not null default 'found',
  evidence_type public.evidence_type not null default 'observed',
  confidence public.confidence_level not null default 'medium',
  value jsonb,                       -- raw value (string | number | boolean | object)
  explanation text,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, signal_type)
);
create index idx_opportunity_signals_business on public.opportunity_signals(business_id);
create index idx_opportunity_signals_type on public.opportunity_signals(signal_type);
create index idx_opportunity_signals_workspace on public.opportunity_signals(workspace_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  overall_score integer not null default 0 check (overall_score between 0 and 100),
  primary_service_id uuid references public.services(id),
  secondary_service_ids uuid[] not null default '{}',
  confidence public.confidence_level not null default 'medium',
  status text not null default 'calculated' check (status in ('calculated', 'stale', 'failed')),
  digital_gaps text[] not null default '{}',    -- quick badges: no_website, weak_website, no_instagram, google_incomplete...
  rules_version integer not null default 1,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_opportunities_workspace_score on public.opportunities(workspace_id, overall_score desc);
create index idx_opportunities_primary_service on public.opportunities(primary_service_id);
create index idx_opportunities_scan on public.opportunities(scan_id);
create trigger trg_opportunities_updated before update on public.opportunities
  for each row execute function public.set_updated_at();

create table public.opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  raw_points integer not null default 0,
  max_points integer not null default 0,
  confidence public.confidence_level not null default 'medium',
  reasons jsonb not null default '[]'::jsonb,   -- [{ ruleKey, points, signalType, explanation, evidenceType }]
  unavailable_rules jsonb not null default '[]'::jsonb, -- rules that could not be evaluated (not_checked)
  created_at timestamptz not null default now(),
  unique (opportunity_id, service_id)
);
create index idx_opportunity_scores_service_score on public.opportunity_scores(workspace_id, service_id, score desc);
create index idx_opportunity_scores_business on public.opportunity_scores(business_id);

create table public.competitor_benchmarks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid references public.categories(id),
  radius_m integer,
  competitors jsonb not null default '[]'::jsonb,  -- [{ businessId?, providerPlaceId, displayName, metrics: {...} }]
  metrics jsonb not null default '{}'::jsonb,      -- current business metrics for the same keys
  created_at timestamptz not null default now()
);
create index idx_competitor_benchmarks_business on public.competitor_benchmarks(business_id, created_at desc);

-- ----------------------------------------------------------------------------
-- CRM
-- ----------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  status public.lead_status not null default 'open',
  owner_id uuid references auth.users(id),
  source_scan_id uuid references public.scans(id) on delete set null,
  primary_service_id uuid references public.services(id),
  estimated_value numeric(12,2),
  won_value numeric(12,2),
  currency text not null default 'TRY',
  loss_reason text,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, business_id)
);
create index idx_leads_workspace_stage on public.leads(workspace_id, stage_id);
create index idx_leads_follow_up on public.leads(workspace_id, next_follow_up_at);
create index idx_leads_owner on public.leads(owner_id);
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid references auth.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_lead_notes_lead on public.lead_notes(lead_id, created_at desc);
create trigger trg_lead_notes_updated before update on public.lead_notes
  for each row execute function public.set_updated_at();

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  actor_id uuid references auth.users(id),
  type text not null,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_lead_activities_business on public.lead_activities(business_id, created_at desc);
create index idx_lead_activities_lead on public.lead_activities(lead_id, created_at desc);
create index idx_lead_activities_workspace on public.lead_activities(workspace_id, created_at desc);
create index idx_lead_activities_type on public.lead_activities(type);

-- ----------------------------------------------------------------------------
-- Outreach
-- ----------------------------------------------------------------------------
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,   -- null for system
  owner_id uuid references auth.users(id) on delete cascade,              -- set for personal
  scope text not null check (scope in ('system', 'workspace', 'personal')),
  key text,                                                              -- stable key for system templates
  name text not null,
  channel public.message_channel not null,
  service_id uuid references public.services(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  tone text not null default 'friendly_professional',
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  subject text,
  body text not null,
  variables text[] not null default '{}',
  active boolean not null default true,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'system' and workspace_id is null and owner_id is null) or
    (scope = 'workspace' and workspace_id is not null) or
    (scope = 'personal' and workspace_id is not null and owner_id is not null)
  )
);
create index idx_message_templates_workspace on public.message_templates(workspace_id);
create index idx_message_templates_scope on public.message_templates(scope, channel);
create unique index uq_message_templates_system_key on public.message_templates(key) where scope = 'system';
create trigger trg_message_templates_updated before update on public.message_templates
  for each row execute function public.set_updated_at();

create table public.message_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  message_id uuid,
  provider text not null,
  model text not null,
  status text not null check (status in ('success', 'failed', 'invalid_output', 'unavailable')),
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  prompt_version text,
  facts_hash text,
  facts_used jsonb not null default '{}'::jsonb,   -- minimal verified facts passed to the model (no PII beyond business facts)
  error_code text,
  credits_consumed integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_message_generations_workspace on public.message_generations(workspace_id, created_at desc);
create index idx_message_generations_business on public.message_generations(business_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  template_id uuid references public.message_templates(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  generation_id uuid references public.message_generations(id) on delete set null,
  channel public.message_channel not null,
  tone text,
  subject text,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'edited', 'copied', 'channel_opened', 'sent_manually', 'archived')),
  copied_at timestamptz,
  channel_opened_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_messages_business on public.messages(business_id, created_at desc);
create index idx_messages_workspace on public.messages(workspace_id, created_at desc);
create trigger trg_messages_updated before update on public.messages
  for each row execute function public.set_updated_at();

alter table public.message_generations
  add constraint message_generations_message_fk foreign key (message_id) references public.messages(id) on delete set null;

create table public.public_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  token text not null unique,
  title text not null,
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  content_snapshot jsonb not null,     -- curated, non-sensitive content only
  branding jsonb not null default '{}'::jsonb,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_public_reports_business on public.public_reports(business_id);
create index idx_public_reports_workspace on public.public_reports(workspace_id);

-- ----------------------------------------------------------------------------
-- Credits & billing
-- ----------------------------------------------------------------------------
create table public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),     -- available (excludes reserved)
  reserved integer not null default 0 check (reserved >= 0),
  lifetime_granted integer not null default 0,
  lifetime_consumed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_credit_accounts_updated before update on public.credit_accounts
  for each row execute function public.set_updated_at();

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.credit_accounts(id) on delete cascade,
  type public.credit_ledger_type not null,
  amount integer not null,                 -- signed effect on available balance
  balance_after integer not null,
  reserved_after integer not null,
  reference_type text,
  reference_id text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_credit_ledger_workspace on public.credit_ledger(workspace_id, created_at desc);
create index idx_credit_ledger_reference on public.credit_ledger(reference_type, reference_id);
create index idx_credit_ledger_type on public.credit_ledger(type);

create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.credit_accounts(id) on delete cascade,
  reference_type text not null,
  reference_id text not null,
  reserved_amount integer not null default 0,
  consumed_amount integer not null default 0,
  refunded_amount integer not null default 0,
  status text not null default 'active' check (status in ('active', 'settled', 'released')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reference_type, reference_id)
);
create index idx_credit_reservations_workspace on public.credit_reservations(workspace_id, status);
create trigger trg_credit_reservations_updated before update on public.credit_reservations
  for each row execute function public.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  provider text not null default 'mock',
  provider_subscription_id text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  cancel_at_period_end boolean not null default false,
  last_grant_period_start timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_subscriptions_workspace on public.subscriptions(workspace_id);
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  provider text not null,
  event_type text not null,
  external_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_billing_events_workspace on public.billing_events(workspace_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Operations
-- ----------------------------------------------------------------------------
create table public.provider_call_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  scan_id uuid references public.scans(id) on delete set null,
  provider_name text not null,
  operation text not null,
  duration_ms integer,
  success boolean not null,
  error_code text,
  estimated_cost numeric(12,6) not null default 0,
  request_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_provider_call_logs_created on public.provider_call_logs(created_at desc);
create index idx_provider_call_logs_workspace on public.provider_call_logs(workspace_id, created_at desc);
create index idx_provider_call_logs_provider on public.provider_call_logs(provider_name, operation);

create table public.rate_limit_buckets (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('workspace', 'account')),
  target_id uuid not null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ============================================================================
-- Functions
-- ============================================================================

-- Profile bootstrap on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tenancy helpers used by RLS
create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role(ws uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role::text from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.workspace_role(ws) in ('owner', 'admin'), false);
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Workspace bootstrap (called by onboarding as the authenticated user)
create or replace function public.create_workspace_with_defaults(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_ws uuid;
  v_plan public.plans%rowtype;
  v_account uuid;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into v_plan from public.plans where is_default and active order by sort_order limit 1;

  insert into public.workspaces (name, slug, owner_id, plan_id)
  values (p_name, p_slug, v_user, v_plan.id)
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, v_user, 'owner');

  insert into public.credit_accounts (workspace_id) values (v_ws) returning id into v_account;

  if v_plan.id is not null then
    insert into public.subscriptions (workspace_id, plan_id, status, provider, last_grant_period_start)
    values (v_ws, v_plan.id, 'active', 'mock', now());
    if v_plan.monthly_credits > 0 then
      perform public.credit_apply(
        v_ws, 'monthly_grant', v_plan.monthly_credits, 'plan', v_plan.key,
        'grant:' || v_ws::text || ':' || to_char(now(), 'YYYY-MM'),
        jsonb_build_object('plan', v_plan.key), v_user
      );
    end if;
  end if;

  insert into public.pipeline_stages (workspace_id, key, name, color, sort_order, is_won, is_lost, is_default) values
    (v_ws, 'new', 'New', 'slate', 10, false, false, true),
    (v_ws, 'contacted', 'Contacted', 'blue', 20, false, false, false),
    (v_ws, 'replied', 'Replied', 'violet', 30, false, false, false),
    (v_ws, 'meeting', 'Meeting', 'amber', 40, false, false, false),
    (v_ws, 'proposal', 'Proposal', 'orange', 50, false, false, false),
    (v_ws, 'won', 'Won', 'emerald', 60, true, false, false),
    (v_ws, 'lost', 'Lost', 'rose', 70, false, true, false);

  insert into public.workspace_services (workspace_id, service_id, enabled, priority)
  select v_ws, s.id, true, s.sort_order from public.services s where s.active;

  update public.profiles set default_workspace_id = coalesce(default_workspace_id, v_ws) where id = v_user;

  return v_ws;
end $$;

-- Atomic credit ledger operation with idempotency and reservation semantics.
-- amount is always positive; type decides the direction.
--   monthly_grant / purchase / admin_adjustment(+) / refund: available += amount (refund: reserved -= amount)
--   reservation: available -= amount, reserved += amount
--   consumption: reserved -= amount (if reference has a reservation) else available -= amount
--   expiration / admin_adjustment(-): available -= amount
create or replace function public.credit_apply(
  p_workspace uuid,
  p_type public.credit_ledger_type,
  p_amount integer,
  p_reference_type text,
  p_reference_id text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_actor uuid default null
)
returns public.credit_ledger language plpgsql security definer set search_path = public as $$
declare
  v_account public.credit_accounts%rowtype;
  v_existing public.credit_ledger%rowtype;
  v_row public.credit_ledger%rowtype;
  v_signed integer;
  v_available integer;
  v_reserved integer;
  v_res public.credit_reservations%rowtype;
  v_negative boolean := coalesce((p_metadata->>'direction') = 'debit', false);
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Idempotent replay
  select * into v_existing from public.credit_ledger where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_account from public.credit_accounts where workspace_id = p_workspace for update;
  if not found then
    insert into public.credit_accounts (workspace_id) values (p_workspace) returning * into v_account;
  end if;

  v_available := v_account.balance;
  v_reserved := v_account.reserved;

  if p_type in ('monthly_grant', 'purchase') or (p_type = 'admin_adjustment' and not v_negative) then
    v_signed := p_amount;
    v_available := v_available + p_amount;
    v_account.lifetime_granted := v_account.lifetime_granted + p_amount;

  elsif p_type = 'reservation' then
    if v_available < p_amount then
      raise exception 'insufficient_credits' using errcode = 'P0001', detail = format('available=%s required=%s', v_available, p_amount);
    end if;
    v_signed := -p_amount;
    v_available := v_available - p_amount;
    v_reserved := v_reserved + p_amount;
    insert into public.credit_reservations (workspace_id, account_id, reference_type, reference_id, reserved_amount)
    values (p_workspace, v_account.id, p_reference_type, p_reference_id, p_amount)
    on conflict (reference_type, reference_id) do update
      set reserved_amount = public.credit_reservations.reserved_amount + excluded.reserved_amount,
          status = 'active';

  elsif p_type = 'consumption' then
    select * into v_res from public.credit_reservations
      where reference_type = p_reference_type and reference_id = p_reference_id for update;
    if found and (v_res.reserved_amount - v_res.consumed_amount - v_res.refunded_amount) >= p_amount then
      -- consume from reservation: available unchanged, reserved decreases
      v_signed := 0;
      v_reserved := v_reserved - p_amount;
      update public.credit_reservations set consumed_amount = consumed_amount + p_amount where id = v_res.id;
    else
      -- direct consumption from available balance
      if v_available < p_amount then
        raise exception 'insufficient_credits' using errcode = 'P0001', detail = format('available=%s required=%s', v_available, p_amount);
      end if;
      v_signed := -p_amount;
      v_available := v_available - p_amount;
    end if;
    v_account.lifetime_consumed := v_account.lifetime_consumed + p_amount;

  elsif p_type = 'refund' then
    select * into v_res from public.credit_reservations
      where reference_type = p_reference_type and reference_id = p_reference_id for update;
    if found then
      declare v_remaining integer := v_res.reserved_amount - v_res.consumed_amount - v_res.refunded_amount;
      begin
        if p_amount > v_remaining then
          raise exception 'refund_exceeds_reservation' using errcode = 'P0002', detail = format('remaining=%s requested=%s', v_remaining, p_amount);
        end if;
        v_reserved := v_reserved - p_amount;
        update public.credit_reservations
          set refunded_amount = refunded_amount + p_amount,
              status = case when (reserved_amount - consumed_amount - refunded_amount - p_amount) <= 0 then 'settled' else status end
          where id = v_res.id;
      end;
    end if;
    v_signed := p_amount;
    v_available := v_available + p_amount;

  elsif p_type = 'expiration' or (p_type = 'admin_adjustment' and v_negative) then
    if v_available < p_amount then
      -- clamp to zero rather than fail; record the actual amount removed
      p_amount := v_available;
    end if;
    v_signed := -p_amount;
    v_available := v_available - p_amount;
  else
    raise exception 'unsupported_ledger_type';
  end if;

  update public.credit_accounts
    set balance = v_available,
        reserved = v_reserved,
        lifetime_granted = v_account.lifetime_granted,
        lifetime_consumed = v_account.lifetime_consumed
    where id = v_account.id;

  insert into public.credit_ledger (
    workspace_id, account_id, type, amount, balance_after, reserved_after,
    reference_type, reference_id, idempotency_key, metadata, created_by
  ) values (
    p_workspace, v_account.id, p_type, v_signed, v_available, v_reserved,
    p_reference_type, p_reference_id, p_idempotency_key, coalesce(p_metadata, '{}'::jsonb), p_actor
  ) returning * into v_row;

  return v_row;
end $$;

-- Ledger immutability
create or replace function public.assert_credit_ledger_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'credit_ledger is immutable' using errcode = '42501';
end $$;
create trigger trg_credit_ledger_no_update before update on public.credit_ledger
  for each row execute function public.assert_credit_ledger_immutable();
create trigger trg_credit_ledger_no_delete before delete on public.credit_ledger
  for each row execute function public.assert_credit_ledger_immutable();

-- Fixed-window rate limiter. Returns true when the request is allowed.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_row public.rate_limit_buckets%rowtype;
  v_now timestamptz := now();
begin
  insert into public.rate_limit_buckets (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case when public.rate_limit_buckets.window_start + make_interval(secs => p_window_seconds) <= v_now then 1 else public.rate_limit_buckets.count + 1 end,
        window_start = case when public.rate_limit_buckets.window_start + make_interval(secs => p_window_seconds) <= v_now then v_now else public.rate_limit_buckets.window_start end
  returning * into v_row;
  return v_row.count <= p_limit;
end $$;

-- Increment counters atomically (used by workflow steps through service role)
create or replace function public.increment_scan_counters(
  p_scan uuid,
  p_discovered integer default 0,
  p_deduplicated integer default 0,
  p_audited integer default 0,
  p_scored integer default 0,
  p_failed integer default 0,
  p_consumed integer default 0
) returns void language sql security definer set search_path = public as $$
  update public.scans set
    discovered_count = discovered_count + coalesce(p_discovered, 0),
    deduplicated_count = deduplicated_count + coalesce(p_deduplicated, 0),
    audited_count = audited_count + coalesce(p_audited, 0),
    scored_count = scored_count + coalesce(p_scored, 0),
    failed_count = failed_count + coalesce(p_failed, 0),
    consumed_credits = consumed_credits + coalesce(p_consumed, 0)
  where id = p_scan;
$$;

-- Template usage counter (called after a draft is saved from a template)
create or replace function public.increment_template_usage(p_template uuid)
returns void language sql security definer set search_path = public as $$
  update public.message_templates set usage_count = usage_count + 1 where id = p_template;
$$;

-- Public report view counter (called from server code for anonymous viewers)
create or replace function public.touch_public_report(p_token text)
returns void language sql security definer set search_path = public as $$
  update public.public_reports set view_count = view_count + 1, last_viewed_at = now()
  where token = p_token and revoked_at is null and (expires_at is null or expires_at > now());
$$;

-- Workspace deletion (owner only). Cascades through FKs.
create or replace function public.delete_workspace(p_workspace uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.workspace_role(p_workspace) <> 'owner' and not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.deletion_requests (requested_by, target_type, target_id, status, completed_at)
  values (auth.uid(), 'workspace', p_workspace, 'completed', now());
  update public.profiles set default_workspace_id = null where default_workspace_id = p_workspace;
  delete from public.workspaces where id = p_workspace;
end $$;

-- ============================================================================
-- Views
-- ============================================================================
create or replace view public.business_overview
with (security_invoker = true) as
select
  b.id,
  b.workspace_id,
  b.provider,
  b.provider_place_id,
  b.normalized_name,
  b.primary_category_id,
  b.is_ignored,
  b.first_scan_id,
  b.last_seen_at,
  b.created_at,
  s.id as snapshot_id,
  s.display_name,
  s.formatted_address,
  s.lat,
  s.lng,
  s.city,
  s.district,
  s.rating,
  s.user_rating_count,
  s.website_uri,
  s.phone_national,
  s.google_maps_uri,
  s.has_opening_hours,
  s.photo_count,
  s.business_status,
  s.expires_at as snapshot_expires_at,
  o.id as opportunity_id,
  o.overall_score,
  o.primary_service_id,
  o.secondary_service_ids,
  o.confidence as opportunity_confidence,
  o.digital_gaps,
  o.calculated_at,
  (select (sig.value #>> '{}') from public.opportunity_signals sig where sig.business_id = b.id and sig.signal_type = 'website.status' limit 1) as website_status,
  (select (sig.value #>> '{}') from public.opportunity_signals sig where sig.business_id = b.id and sig.signal_type = 'instagram.status' limit 1) as instagram_status,
  (select (sig.value #>> '{}') from public.opportunity_signals sig where sig.business_id = b.id and sig.signal_type = 'google.profile_completeness' limit 1) as google_completeness,
  l.id as lead_id,
  l.stage_id,
  l.status as lead_status,
  l.last_contacted_at,
  l.next_follow_up_at
from public.businesses b
left join lateral (
  select * from public.business_provider_snapshots ps
  where ps.business_id = b.id order by ps.fetched_at desc limit 1
) s on true
left join public.opportunities o on o.business_id = b.id
left join public.leads l on l.business_id = b.id and l.workspace_id = b.workspace_id;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.categories enable row level security;
alter table public.category_provider_mappings enable row level security;
alter table public.services enable row level security;
alter table public.service_rules enable row level security;
alter table public.credit_pricing_rules enable row level security;
alter table public.system_settings enable row level security;
alter table public.workspace_services enable row level security;
alter table public.service_offerings enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.saved_areas enable row level security;
alter table public.integrations enable row level security;
alter table public.api_keys enable row level security;
alter table public.scans enable row level security;
alter table public.scan_categories enable row level security;
alter table public.scan_services enable row level security;
alter table public.scan_targets enable row level security;
alter table public.scan_jobs enable row level security;
alter table public.scan_job_events enable row level security;
alter table public.businesses enable row level security;
alter table public.scan_businesses enable row level security;
alter table public.business_provider_snapshots enable row level security;
alter table public.business_contacts enable row level security;
alter table public.business_audits enable row level security;
alter table public.audit_findings enable row level security;
alter table public.opportunity_signals enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_scores enable row level security;
alter table public.competitor_benchmarks enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_activities enable row level security;
alter table public.message_templates enable row level security;
alter table public.message_generations enable row level security;
alter table public.messages enable row level security;
alter table public.public_reports enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.provider_call_logs enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.deletion_requests enable row level security;

-- profiles
create policy profiles_select_self on public.profiles for select
  using (id = auth.uid() or public.is_platform_admin());
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and is_platform_admin = (select p.is_platform_admin from public.profiles p where p.id = auth.uid()));
-- members of the same workspace may read basic profile rows (for owner names etc.)
create policy profiles_select_coworkers on public.profiles for select
  using (exists (
    select 1 from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  ));

-- reference data: readable by authenticated users; writes only via service role / platform admin
create policy plans_read on public.plans for select to authenticated using (true);
create policy categories_read on public.categories for select to authenticated using (true);
create policy cpm_read on public.category_provider_mappings for select to authenticated using (true);
create policy services_read on public.services for select to authenticated using (true);
create policy service_rules_read on public.service_rules for select to authenticated using (true);
create policy credit_pricing_read on public.credit_pricing_rules for select to authenticated using (true);
create policy system_settings_read on public.system_settings for select to authenticated using (public.is_platform_admin() or key like 'public.%');
create policy plans_admin_write on public.plans for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy categories_admin_write on public.categories for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy cpm_admin_write on public.category_provider_mappings for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy services_admin_write on public.services for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy service_rules_admin_write on public.service_rules for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy credit_pricing_admin_write on public.credit_pricing_rules for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy system_settings_admin_write on public.system_settings for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- workspaces
create policy workspaces_select on public.workspaces for select
  using (public.is_workspace_member(id) or public.is_platform_admin());
create policy workspaces_insert on public.workspaces for insert
  with check (owner_id = auth.uid());
create policy workspaces_update on public.workspaces for update
  using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));
create policy workspaces_delete on public.workspaces for delete
  using (public.workspace_role(id) = 'owner');

-- workspace_members
create policy wm_select on public.workspace_members for select
  using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy wm_insert on public.workspace_members for insert
  with check (public.is_workspace_admin(workspace_id) or (user_id = auth.uid() and exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())));
create policy wm_update on public.workspace_members for update
  using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy wm_delete on public.workspace_members for delete
  using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

create policy wi_all on public.workspace_invitations for all
  using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

-- generic member policies (macro-like repetition kept explicit for auditability)
create policy ws_services_select on public.workspace_services for select using (public.is_workspace_member(workspace_id));
create policy ws_services_write on public.workspace_services for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create policy offerings_select on public.service_offerings for select using (public.is_workspace_member(workspace_id));
create policy offerings_write on public.service_offerings for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create policy stages_select on public.pipeline_stages for select using (public.is_workspace_member(workspace_id));
create policy stages_write on public.pipeline_stages for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create policy saved_areas_select on public.saved_areas for select using (public.is_workspace_member(workspace_id));
create policy saved_areas_write on public.saved_areas for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy integrations_select on public.integrations for select using (public.is_workspace_member(workspace_id));
create policy integrations_write on public.integrations for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create policy api_keys_select on public.api_keys for select using (public.is_workspace_admin(workspace_id));
create policy api_keys_write on public.api_keys for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

-- scans
create policy scans_select on public.scans for select using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy scans_insert on public.scans for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy scans_update on public.scans for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy scans_delete on public.scans for delete using (public.is_workspace_admin(workspace_id));

create policy scan_categories_select on public.scan_categories for select using (exists (select 1 from public.scans s where s.id = scan_id and public.is_workspace_member(s.workspace_id)));
create policy scan_categories_insert on public.scan_categories for insert with check (exists (select 1 from public.scans s where s.id = scan_id and public.is_workspace_member(s.workspace_id)));
create policy scan_services_select on public.scan_services for select using (exists (select 1 from public.scans s where s.id = scan_id and public.is_workspace_member(s.workspace_id)));
create policy scan_services_insert on public.scan_services for insert with check (exists (select 1 from public.scans s where s.id = scan_id and public.is_workspace_member(s.workspace_id)));

create policy scan_targets_select on public.scan_targets for select using (public.is_workspace_member(workspace_id));
create policy scan_jobs_select on public.scan_jobs for select using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy scan_job_events_select on public.scan_job_events for select using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
-- writes to scan_targets / scan_jobs / scan_job_events happen through the service role only

-- businesses & related
create policy businesses_select on public.businesses for select using (public.is_workspace_member(workspace_id));
create policy businesses_insert on public.businesses for insert with check (public.is_workspace_member(workspace_id));
create policy businesses_update on public.businesses for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy businesses_delete on public.businesses for delete using (public.is_workspace_admin(workspace_id));

create policy scan_businesses_select on public.scan_businesses for select using (public.is_workspace_member(workspace_id));
create policy scan_businesses_insert on public.scan_businesses for insert with check (public.is_workspace_member(workspace_id));

create policy bps_select on public.business_provider_snapshots for select using (public.is_workspace_member(workspace_id));
create policy bps_insert on public.business_provider_snapshots for insert with check (public.is_workspace_member(workspace_id));
create policy bps_delete on public.business_provider_snapshots for delete using (public.is_workspace_member(workspace_id));

create policy contacts_select on public.business_contacts for select using (public.is_workspace_member(workspace_id));
create policy contacts_write on public.business_contacts for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy audits_select on public.business_audits for select using (public.is_workspace_member(workspace_id));
create policy audits_insert on public.business_audits for insert with check (public.is_workspace_member(workspace_id));
create policy findings_select on public.audit_findings for select using (public.is_workspace_member(workspace_id));
create policy signals_select on public.opportunity_signals for select using (public.is_workspace_member(workspace_id));
create policy opportunities_select on public.opportunities for select using (public.is_workspace_member(workspace_id));
create policy opportunity_scores_select on public.opportunity_scores for select using (public.is_workspace_member(workspace_id));
create policy benchmarks_select on public.competitor_benchmarks for select using (public.is_workspace_member(workspace_id));

-- CRM
create policy leads_select on public.leads for select using (public.is_workspace_member(workspace_id));
create policy leads_write on public.leads for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy lead_notes_select on public.lead_notes for select using (public.is_workspace_member(workspace_id));
create policy lead_notes_insert on public.lead_notes for insert with check (public.is_workspace_member(workspace_id) and author_id = auth.uid());
create policy lead_notes_update on public.lead_notes for update using (public.is_workspace_member(workspace_id) and author_id = auth.uid());
create policy lead_notes_delete on public.lead_notes for delete using (public.is_workspace_admin(workspace_id) or author_id = auth.uid());
create policy activities_select on public.lead_activities for select using (public.is_workspace_member(workspace_id));
create policy activities_insert on public.lead_activities for insert with check (public.is_workspace_member(workspace_id));

-- outreach
create policy templates_select on public.message_templates for select
  using (scope = 'system' or (scope = 'workspace' and public.is_workspace_member(workspace_id)) or (scope = 'personal' and owner_id = auth.uid()));
create policy templates_insert on public.message_templates for insert
  with check ((scope = 'workspace' and public.is_workspace_member(workspace_id)) or (scope = 'personal' and owner_id = auth.uid() and public.is_workspace_member(workspace_id)) or (scope = 'system' and public.is_platform_admin()));
create policy templates_update on public.message_templates for update
  using ((scope = 'workspace' and public.is_workspace_member(workspace_id)) or (scope = 'personal' and owner_id = auth.uid()) or (scope = 'system' and public.is_platform_admin()));
create policy templates_delete on public.message_templates for delete
  using ((scope = 'workspace' and public.is_workspace_admin(workspace_id)) or (scope = 'personal' and owner_id = auth.uid()) or (scope = 'system' and public.is_platform_admin()));

create policy generations_select on public.message_generations for select using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy generations_insert on public.message_generations for insert with check (public.is_workspace_member(workspace_id));

create policy messages_select on public.messages for select using (public.is_workspace_member(workspace_id));
create policy messages_write on public.messages for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy reports_select on public.public_reports for select using (public.is_workspace_member(workspace_id));
create policy reports_write on public.public_reports for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- credits & billing (writes only via functions / service role)
create policy credit_accounts_select on public.credit_accounts for select using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy credit_ledger_select on public.credit_ledger for select using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy credit_reservations_select on public.credit_reservations for select using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy subscriptions_select on public.subscriptions for select using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy billing_events_select on public.billing_events for select using (public.is_workspace_admin(workspace_id) or public.is_platform_admin());

-- operations
create policy provider_call_logs_select on public.provider_call_logs for select using (public.is_platform_admin() or (workspace_id is not null and public.is_workspace_admin(workspace_id)));
create policy deletion_requests_select on public.deletion_requests for select using (public.is_platform_admin() or requested_by = auth.uid());
-- rate_limit_buckets: no policies => only service role / security definer function

-- Grants (Supabase default roles)
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.business_overview to authenticated;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.credit_apply(uuid, public.credit_ledger_type, integer, text, text, text, jsonb, uuid) from anon, authenticated;
revoke execute on function public.increment_scan_counters(uuid, integer, integer, integer, integer, integer, integer) from anon, authenticated;
revoke execute on function public.rate_limit_hit(text, integer, integer) from anon, authenticated;
revoke execute on function public.touch_public_report(text) from anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
