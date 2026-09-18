# Database

Supabase Postgres. Migrations live in `supabase/migrations`, reference data in
`supabase/seed.sql`. UUID primary keys (`gen_random_uuid()`), `timestamptz` timestamps,
`updated_at` maintained by trigger. Row Level Security is enabled on every table.

## Conventions

* Every workspace-scoped table has `workspace_id uuid not null references workspaces(id) on delete cascade`.
* Enumerations that drive state machines are Postgres enums; descriptive categories are
  `text` with `check` constraints so they can be extended by migration without type churn.
* JSONB is used only for genuinely flexible payloads: geometry, filters, audit summaries,
  evidence, signal values, metadata.
* Indexes exist for `workspace_id`, `scan_id`, `business_id`, `provider_place_id`,
  statuses, scores, `service_id`, `created_at`, plus the natural unique keys below.

## Tables

### Identity and tenancy
| Table | Purpose | Natural keys |
| --- | --- | --- |
| `profiles` | 1:1 with `auth.users`; display name, locale, `is_platform_admin`, onboarding state | `id = auth.users.id` |
| `workspaces` | Tenant: name, slug, sender & company info, default tone/locale, branding | `slug` |
| `workspace_members` | Membership with role `owner / admin / member` | `(workspace_id, user_id)` |
| `workspace_invitations` | Pending e-mail invitations | `token` |

### Reference data (platform-wide, admin-editable)
| Table | Purpose |
| --- | --- |
| `categories` | Internal industry categories (Restaurants & Cafes, Hair Salons, ...) |
| `category_provider_mappings` | `category -> provider type / text query`, per provider |
| `services` | Sellable service types (website_development, seo, ...) with `score_normalizer` |
| `service_rules` | Scoring rules: `signal_type`, `operator`, `value`, `points`, i18n explanation |
| `plans` | Plan definitions with monthly credits |
| `credit_pricing_rules` | Cost per unit for discovery, basic_audit, deep_audit, ai_message, report |
| `system_settings` | Key/value JSON: feature flags, rate limits, provider and AI configuration |
| `message_templates` (scope = `system`) | Built-in templates |

### Workspace configuration
| Table | Purpose | Natural keys |
| --- | --- | --- |
| `workspace_services` | Which services the workspace sells, priority | `(workspace_id, service_id)` |
| `service_offerings` | Packages: name, price range, billing period, delivery time, prompt context | |
| `pipeline_stages` | Per-workspace stages (seeded defaults, custom later) | `(workspace_id, key)` |
| `saved_areas` | Saved polygons | |
| `integrations` | Non-secret per-workspace integration toggles | `(workspace_id, type)` |
| `api_keys` | Hashed API keys (prefix + sha256) | `key_hash` |

### Scans
| Table | Purpose | Natural keys |
| --- | --- | --- |
| `scans` | Scan definition, lifecycle status, counters, credit figures, `workflow_run_id`, coverage metadata | |
| `scan_categories`, `scan_services` | Selected categories / services | `(scan_id, x_id)` |
| `scan_targets` | Coverage cells (centre, radius, category) with result counts | `(scan_id, cell_index, category_id)` |
| `scan_jobs` | Unit of work (discovery cell, business audit, scoring) with attempts and `idempotency_key` | `idempotency_key` |
| `scan_job_events` | Append-only event log for a scan/job | |
| `scan_businesses` | Membership of a business in a scan: matched category, position, audit/opportunity status | `(scan_id, business_id)` |

### Businesses (provider data separated from CRM data)
| Table | Purpose | Natural keys |
| --- | --- | --- |
| `businesses` | Identity only: provider, `provider_place_id`, `normalized_name`, `canonical_fingerprint`, ignore flag | `(workspace_id, provider, provider_place_id)` |
| `business_provider_snapshots` | Cached provider payload subset with `fetched_at` / `expires_at` | |
| `business_contacts` | Contact channels (phone, e-mail, whatsapp, instagram, website) with source + confidence | |
| `business_audits` | One row per audit run and type (website, google_business, instagram, performance, competitor) | |
| `audit_findings` | Individual findings with status, evidence type, confidence, evidence JSON | |
| `opportunity_signals` | Normalised signals consumed by the scoring engine | |
| `opportunities` | Current opportunity per business: overall score, primary/secondary services, confidence | `business_id` |
| `opportunity_scores` | Per-service score with reasons | `(opportunity_id, service_id)` |
| `competitor_benchmarks` | Optional benchmark snapshot (neutral metric comparison) | |

### CRM
| Table | Purpose | Natural keys |
| --- | --- | --- |
| `leads` | Pipeline entry per business: stage, status, owner, value, follow-up | `(workspace_id, business_id)` |
| `lead_notes` | Notes | |
| `lead_activities` | Activity timeline (scan, audit, message, pipeline events) | |

### Outreach
| Table | Purpose |
| --- | --- |
| `message_templates` | System / workspace / personal templates with variables |
| `messages` | Drafts per business & channel with status (draft, edited, copied, opened) |
| `message_generations` | AI generation log: provider, model, latency, tokens, status, facts hash |
| `public_reports` | Shareable report tokens with curated `content_snapshot`, expiry, revocation |

### Credits and billing
| Table | Purpose |
| --- | --- |
| `credit_accounts` | One per workspace: cached `balance` and `reserved`, monthly grant |
| `credit_ledger` | Immutable entries: type, signed amount, `balance_after`, reference, `idempotency_key` |
| `credit_reservations` | Aggregates per reference (scan): reserved / consumed / refunded |
| `subscriptions` | Plan subscription (mock provider in MVP) |
| `billing_events` | Provider webhook / event log |

### Operations
| Table | Purpose |
| --- | --- |
| `provider_call_logs` | Every external call: provider, operation, duration, success, error code, estimated cost |
| `rate_limit_buckets` | Fixed-window counters keyed by `key` |
| `deletion_requests` | Account / workspace deletion audit |

## Functions

* `is_workspace_member(ws uuid) returns boolean`, `workspace_role(ws uuid) returns text`,
  `is_platform_admin() returns boolean`: `security definer`, `stable`, used by RLS.
* `handle_new_user()`: trigger on `auth.users` creating a `profiles` row.
* `create_workspace_with_defaults(name, slug)`: creates workspace, owner membership, credit
  account with plan grant, default pipeline stages, enables default services. Called by
  onboarding as the authenticated user (RLS-safe, `security definer` with explicit
  `auth.uid()` checks).
* `credit_apply(...)`: atomic ledger operation with idempotency, row lock, balance checks.
  Returns the ledger row (existing row on replay). Raises `insufficient_credits`.
* `rate_limit_hit(key, limit, window_seconds) returns boolean`.
* `increment_scan_counters(scan, ...)`: atomic counter bumps from workflow steps.
* `increment_template_usage(template)`: usage telemetry after a draft is saved.
* `touch_public_report(token)`: view counter for anonymous report viewers.
* `delete_workspace(workspace)`: owner-only cascade delete with an audit row.
* `assert_credit_ledger_immutable()`: trigger blocking UPDATE / DELETE on `credit_ledger`.

## Views

* `business_overview` (`security_invoker = true`): business + latest snapshot + current
  opportunity + lead stage + statuses; the main read model for lists. RLS of the underlying
  tables applies.

## RLS summary

| Table group | select | insert | update | delete |
| --- | --- | --- | --- | --- |
| Reference (categories, services, rules, plans, pricing, system templates, settings) | authenticated | platform admin (service role) | platform admin | platform admin |
| Workspace-scoped | member | member (owner/admin for config, team, billing) | member (role-gated) | owner/admin |
| `credit_ledger`, `provider_call_logs`, `scan_job_events`, `message_generations` | member | service role only | never | never |
| `profiles` | self (and platform admin) | trigger | self | never (deletion via function) |
| `public_reports` | member | member | member | member; public read goes through server code by token only |

The service-role key is used only in server code (workflow steps, admin area, internal
endpoints) and never sent to the browser.
