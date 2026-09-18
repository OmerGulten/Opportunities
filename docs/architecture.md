# OpportunityOS — Architecture

OpportunityOS is a multi-tenant SaaS for local-business lead discovery, digital-presence
auditing, service-specific opportunity scoring, AI-assisted outreach drafting and a light
sales pipeline. It is a single Next.js (App Router) repository deployed on Vercel with
Supabase (Postgres + Auth + RLS) as the system of record and Vercel Workflows (Workflow
DevKit, `workflow` package) for durable asynchronous scan jobs.

## Core concept

> Find businesses whose *observable* problems match the services the user sells.

Every score is derived from **signals** (`opportunity_signals`) that carry a type, source,
value, confidence, evidence type (observed / derived / heuristic / unavailable), status and a
human-readable explanation. Scores are explainable by construction: each service score is a
list of matched rules with their points. We never predict purchase probability.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components by default, Turbopack) |
| Language | TypeScript 5 (strict) |
| UI | Tailwind CSS v4, shadcn/ui (`base-nova` style on Base UI), Lucide icons, Recharts |
| Data | Supabase Postgres, Supabase Auth, Row Level Security |
| Async jobs | Vercel Workflows (`"use workflow"` / `"use step"` directives) |
| Places | Google Places API (New) behind a `PlaceProvider` interface |
| Maps | Google Maps JavaScript API via `@vis.gl/react-google-maps` |
| AI | OpenAI Responses API behind an `AIProvider` interface |
| Performance | Google PageSpeed Insights behind a `PerformanceProvider` interface |
| Validation | Zod (all API inputs, all AI outputs) |
| Tests | Vitest |

## Repository layout

```
src/
  app/
    (marketing)/         Legal pages (terms, privacy, cookies, AI disclosure)
    (auth)/              Sign in, sign up, forgot/reset password
    (onboarding)/        First-run workspace wizard
    (app)/               Authenticated shell: sidebar + topbar, one segment per feature
    admin/               Platform admin (is_platform_admin only)
    report/[token]/      Public read-only audit report
    api/                 Application API (Route Handlers)
    api/internal/        Cron and workflow callbacks, INTERNAL_API_SECRET protected
    page.tsx             Landing page
  components/
    ui/                  shadcn primitives (generated)
    app/                 Shell: sidebar, topbar, workspace switcher, credits pill, logo
    shared/              Cross-feature: StatusBadge, ScoreRing, DataTable, PageHeader, ...
    map/                 Google Maps canvas, radius circle, polygon drawer, markers
  features/<domain>/     One folder per domain: schemas.ts (Zod), service.ts (writes),
                         queries.ts (reads), actions.ts (server actions), components/
                         Domains: auth, workspace, scans, businesses, opportunities,
                         messages, templates, pipeline, analytics, reports, settings, admin
  lib/
    config/              env parsing (public vs server), demo-mode flags
    errors/              Typed AppError hierarchy and HTTP mapping
    logging/             Structured JSON logger with redaction
    supabase/            Browser / server / admin clients, proxy session refresh
    auth/                Session and workspace context, role guards
    api/                 withApi / withInternalApi / withPublicApi route wrappers
    db/                  system_settings and reference-data readers
    i18n/                tr + en dictionaries, server getT(), client useT()
    providers/
      registry.ts        Chooses real or demo providers from env
      places/            PlaceProvider: Google Places (New), demo, coverage, field masks
      ai/                AIProvider: OpenAI Responses, demo, prompts, schemas, fact guard
      performance/       PerformanceProvider: PageSpeed, heuristic
      policy/            Provider policy layer (caching, attribution, export limits)
      call-log.ts        Timing and cost record for every external call
    audits/              Website, Google Business, Instagram, performance, branding,
                         competitor benchmark, orchestration and row mapping
    scoring/             Rule engine: signals x service_rules -> explainable scores
    credits/             CreditService over the immutable ledger, pricing, keys
    security/            safeFetchUrl (SSRF-hardened), IP/URL guards, tokens, sanitise
    billing/             BillingProvider / SubscriptionProvider, mock implementation
    workflows/           scan-state.ts plus scan/ (workflow bodies and steps)
    geo/                 Haversine, polygon validation and area
    demo/                Fictional businesses and fixture websites
    rate-limit/          DB-backed fixed-window limiter
    activity/            Activity timeline append helper
    utils/               Formatting and slug helpers
  types/                 Shared domain types (common, signals, audits, scoring, places, ai, db)
supabase/
  migrations/            Schema, functions, RLS
  seed.sql               Categories, services, scoring rules, plans, pricing, templates
scripts/                 check-sql.ts, check-i18n.ts
docs/                    This documentation
tests/                   Cross-module fixtures and integration tests
```

## Request flow

1. `src/proxy.ts` refreshes the Supabase session cookie on every request and redirects
   unauthenticated users away from the app segment.
2. Server Components under `(app)` call `requireWorkspaceContext()` which resolves the user
   from the session (`auth.getClaims()`), the current workspace from a validated cookie and
   the role from `workspace_members`. The client never supplies a trusted `workspace_id`.
3. Reads use the **user-scoped** Supabase client so Postgres RLS is the final authority.
4. Mutations go through Route Handlers wrapped by `withApi()` (Zod validation, rate limit,
   error mapping) or Server Actions, again with the user-scoped client.
5. Background work (scans) runs in Vercel Workflow steps using the **service-role** client.
   Steps always derive `workspace_id` from the `scans` row they were started for and never
   from input.

## Multi-tenancy

* Every business-level table carries `workspace_id`.
* RLS policies use `public.is_workspace_member(workspace_id)` / `public.workspace_role(workspace_id)`.
* Roles: `owner` (all), `admin` (workspace management, team, billing), `member` (discovery + CRM).
* Platform admins (`profiles.is_platform_admin`) access `/admin` via server-side checks.
* Reference tables (categories, services, service_rules, plans, credit_pricing_rules,
  system templates) are readable by all authenticated users and writable only by platform
  admins (through the service-role client in admin server code).

## Provider abstraction

* `PlaceProvider`: `searchBusinesses`, `getBusinessDetails`, `getBusinessMapUrl`, `policy`.
* `AIProvider`: `generateMessage`, `analyzeOpportunity`. Output is JSON validated with Zod.
* `PerformanceProvider`: `audit(url, strategy)`; PageSpeed when configured, heuristic
  otherwise (results are explicitly labelled `heuristic`).
* `BillingProvider` / `SubscriptionProvider`: `MockBillingProvider` in the MVP.

Provider selection lives in `lib/providers/registry.ts` and is driven by env and `DEMO_MODE`.
Demo providers ship realistic fictional data so the whole UI runs without paid credentials.

## Credits

Credits are an immutable ledger (`credit_ledger`) with reservation semantics executed inside
a single Postgres function (`credit_apply`) that locks the `credit_accounts` row. Every
mutation carries an `idempotency_key`; replays return the original entry. See
`docs/database.md` and `lib/credits`.

## Security summary

* Secrets are server-only (`lib/config/env.ts` splits public vs server env).
* `safeFetchUrl()` blocks non-http(s) schemes, private/loopback/link-local/multicast ranges
  (checked after DNS resolution and on every redirect), caps redirects, body size and time.
* AI prompts treat fetched website content as untrusted data and only receive verified facts.
* Public report tokens are 256-bit random, revocable and expire.
* Rate limits (`rate_limit_hit` SQL function) protect scan creation, AI generation, audits,
  public reports and auth-sensitive endpoints; limits are read from `system_settings`.
* Internal endpoints require `INTERNAL_API_SECRET`.
* No stack traces reach users; errors map to typed codes and localized messages.

## Observability

Structured JSON logs carry `scan_id`, `workspace_id`, `job_id`, `generation_id`. External
calls are recorded in `provider_call_logs` (provider, operation, duration, success, error
code, estimated cost, context). Secrets and full message bodies are never logged.
