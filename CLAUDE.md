# OpportunityOS

Multi-tenant SaaS: local-business lead discovery, digital-presence auditing, service-specific
opportunity scoring, AI-assisted outreach drafting, sales pipeline. Next.js 16 App Router,
TypeScript, Tailwind v4, shadcn (base-nova / Base UI), Supabase (Postgres + Auth + RLS),
Vercel Workflows (`workflow` package), Google Places API (New), OpenAI Responses API.

## Read first

- `docs/conventions.md` — coding rules (auth/tenancy, i18n, shadcn API differences, errors, testing)
- `docs/architecture.md`, `docs/database.md`, `docs/workflows.md`, `docs/provider-policy.md`, `docs/product.md`
- `src/types/*.ts` — shared domain types (signals, audits, scoring, places, AI, DB rows)

## Commands

```bash
npm run dev          # Next dev server (Turbopack). Workflow Local World in .workflow-data/
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run test         # vitest run
npm run build        # next build
npx supabase start   # local Supabase (Docker); applies migrations + seed.sql
npx workflow web     # workflow observability UI
```

## Non-negotiables

- Never trust `workspace_id` from the client; derive from session via `requireWorkspaceContext()`.
- Service-role client only in workflow steps, `/api/internal`, platform-admin code.
- No hard-coded UI strings; use i18n namespaces (`tr` primary, `en` secondary).
- Audits emit explicit statuses (`found | not_found | not_checked | unavailable | error | ambiguous`)
  and evidence types (`observed | derived | heuristic | unavailable`). Never invent facts.
- All external URL fetches go through `safeFetchUrl()`; all Places fields through `field-masks.ts`.
- Do not `npm install` new packages without noting it; the dependency set is intentional.
