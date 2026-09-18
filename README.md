# OpportunityOS

Find local businesses whose **observable** digital problems match the services you sell.

OpportunityOS is a multi-tenant SaaS for lead discovery, digital-presence auditing,
service-specific opportunity scoring, AI-assisted outreach drafting and a light sales
pipeline. It is aimed at freelancers and small agencies selling web development, SEO, social
media, Google Business optimisation, review management and branding.

## The idea

Most tools answer "which businesses have no website". That is one signal. OpportunityOS
scores each business separately for **every service you sell**, from evidence it actually
observed:

```
Kadıköy restaurant                Website Development  82
                                  Review Management    91   <- primary opportunity
                                  Google Business      88
                                  SEO                  74
                                  Social Media         61
                                  Branding             42
```

Every score decomposes into the rules that produced it, each tied to a signal with a source,
a confidence level and an evidence type. Nothing is asserted that was not observed.

## Data honesty

These are product requirements, enforced in code and covered by tests:

- Statuses are explicit: `found`, `not_found`, `not_checked`, `unavailable`, `error`,
  `ambiguous`. A check that did not run is never rendered as "missing".
- Evidence is labelled `observed`, `derived`, `heuristic` or `unavailable`. A heuristic
  performance estimate is never presented as a Lighthouse score.
- No purchase-probability or predicted-revenue figures anywhere.
- Provider results are a sweep, not a census, and the UI says so.
- AI drafts are grounded in facts read from the database and then checked back against them;
  anything unverifiable is surfaced as a warning rather than shipped silently.
- Nothing is sent on the user's behalf. Messages are drafted; the user copies and sends.

## Stack

Next.js 16 (App Router, Server Components), TypeScript, Tailwind v4, shadcn/ui (base-nova on
Base UI), Supabase (Postgres, Auth, Row Level Security), Vercel Workflows for durable scan
jobs, Google Places API (New), Google Maps JavaScript API, OpenAI Responses API, Zod, Vitest.

## Getting started

```bash
npm install
cp .env.example .env.local
```

Start the database (needs Docker). This applies the migrations and the reference seed:

```bash
npm run db:start
```

Copy the printed `API URL`, `publishable key` and `service_role key` into `.env.local`, then:

```bash
npm run dev
```

Open http://localhost:3000, create an account and complete onboarding.

### Running without external API keys

Supabase is required. Everything else has a demo implementation: with no
`GOOGLE_PLACES_API_KEY`, `OPENAI_API_KEY` or `GOOGLE_PAGESPEED_API_KEY`, the app uses
fictional businesses, fixture websites, a deterministic message writer and a heuristic
performance audit, and shows a persistent "Demo data" indicator. Set `DEMO_MODE=true` to
force this even when keys exist. The map degrades to a readable placeholder without
`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, and the scan wizard stays fully usable.

### Credentials, when you want the real thing

| Variable | What it enables | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth and all data | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Workflow steps, admin, internal jobs | Server only, never exposed |
| `GOOGLE_PLACES_API_KEY` | Real business discovery | Server only. Restrict to Places API (New) |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Maps in the browser | Restrict by HTTP referrer |
| `GOOGLE_PAGESPEED_API_KEY` | Measured performance scores | Without it, results are heuristic and labelled as such |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | AI drafting | Server only |
| `INTERNAL_API_SECRET` | `/api/internal/*` cron endpoints | Bearer token |

## Commands

```bash
npm run dev          # dev server; workflows run in the Local World (.workflow-data/)
npm run check        # typecheck, lint, SQL check, i18n check, tests, build
npm run test         # vitest
npm run check:sql    # validates migrations and seed without a database
npm run check:i18n   # tr and en dictionaries must stay in step
npm run db:reset     # re-apply migrations + seed
npm run workflow:web # workflow observability UI
```

`npm run check:sql` exists because the schema cannot always be executed locally: it parses
the migrations and verifies foreign keys, indexes, policies, triggers, enum literals and seed
columns, and fails if any table is missing row level security.

## How a scan works

1. The wizard plans coverage cells over a radius or a drawn polygon and prices the scan.
2. Credits are reserved, then a durable workflow runs: discover per cell, deduplicate, and
   for each business audit, score and bill it.
3. One failing business never fails the scan. Transient provider errors back off and retry.
4. Unused reservation is refunded when the scan finishes, fails or is cancelled.

Every step is idempotent, so a crash resumes rather than double-charging. See
[docs/workflows.md](docs/workflows.md).

## First administrator

Once the database is migrated and `SUPABASE_SERVICE_ROLE_KEY` is set:

```bash
npm run admin:create -- --email you@example.com --workspace "Your Agency"
```

Creates the account, grants platform admin (unlocking `/admin`), creates the workspace
and marks its credit account **unlimited** — scans and AI drafts are still recorded, with
real usage figures, but are never billed. Idempotent; prints the generated password once.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/product.md](docs/product.md) | What it does and the principles it holds to |
| [docs/architecture.md](docs/architecture.md) | Layers, request flow, multi-tenancy, providers |
| [docs/database.md](docs/database.md) | Schema, functions, RLS |
| [docs/workflows.md](docs/workflows.md) | The durable scan engine |
| [docs/provider-policy.md](docs/provider-policy.md) | Caching, attribution and export constraints |
| [docs/security.md](docs/security.md) | SSRF protection and its limits |
| [docs/ai.md](docs/ai.md) | Prompting, structured output, the fact guard |
| [docs/conventions.md](docs/conventions.md) | Coding rules for contributors |
| [docs/deployment.md](docs/deployment.md) | Vercel setup, migrations, first admin |

## Compliance

Google Places content is cached only within policy, attributed where required, and never
bulk-exported; only the place ID is stored indefinitely. The product does not build mailing
lists and does not send outreach automatically. Workspace deletion, account deletion and
public report revocation are built in.

## Deployment

Deploy to Vercel. Enable **System Environment Variables** in the project settings so the
Workflow runtime can read `VERCEL_DEPLOYMENT_ID`; without it, workflows fall back to the
local filesystem world and fail on Vercel's read-only filesystem. Point the Supabase
environment variables at a hosted project and apply the migrations there.
